import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { 
  doc, onSnapshot, updateDoc, collection, addDoc, 
  query, where, getDocs, increment, orderBy, limit,
  serverTimestamp
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Play, Eye, PenTool, Vote, Trophy, 
  ArrowRight, RefreshCw, Sparkles, LogOut, Share2,
  Mic, FileText
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { getAIFeedback, generateImageFromDescription, extractTextFromImage } from '../lib/gemini';

interface GameRoomProps {
  user: User;
  sessionId: string;
  onExit: () => void;
}

export function GameRoom({ user, sessionId, onExit }: GameRoomProps) {
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [mySubmission, setMySubmission] = useState<string>('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const handleGetFeedback = async () => {
    if (!mySubmission.trim()) return;
    setIsGettingFeedback(true);
    try {
      const feedback = await getAIFeedback(session.artworkTitle, mySubmission);
      setAiFeedback(feedback);
      toast.success("AI 피드백이 도착했습니다!");
    } catch (error) {
      toast.error("피드백 생성 실패");
    } finally {
      setIsGettingFeedback(false);
    }
  };
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isTeacher = session?.teacherId === user.uid;

  useEffect(() => {
    const unsubSession = onSnapshot(doc(db, 'sessions', sessionId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSession({ id: doc.id, ...data });
        
        if (data.status === 'describing' && data.timeLimit && timeLeft === null) {
          setTimeLeft(data.timeLimit);
        } else if (data.status !== 'describing') {
          setTimeLeft(null);
        }
      }
    });

    const unsubParticipants = onSnapshot(collection(db, `sessions/${sessionId}/participants`), (snapshot) => {
      setParticipants(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSubmissions = onSnapshot(
      query(collection(db, `sessions/${sessionId}/submissions`), orderBy('votes', 'desc')), 
      (snapshot) => {
        setSubmissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    const unsubResults = onSnapshot(collection(db, `sessions/${sessionId}/results`), (snapshot) => {
      setResults(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubSession();
      unsubParticipants();
      unsubSubmissions();
      unsubResults();
    };
  }, [sessionId, timeLeft]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timeLeft !== null && timeLeft > 0 && session?.status === 'describing') {
      interval = setInterval(() => {
        setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timeLeft === 0 && isTeacher && session?.status === 'describing') {
      updateStatus('voting');
    }

    return () => clearInterval(interval);
  }, [timeLeft, session?.status, isTeacher]);

  // Reset local state when round or status changes
  useEffect(() => {
    setHasSubmitted(false);
    setHasVoted(false);
    setMySubmission('');
  }, [session?.currentRound, session?.status]);

  const updateStatus = async (status: string) => {
    await updateDoc(doc(db, 'sessions', sessionId), { status });
  };

  const handleSubmitDescription = async () => {
    if (!mySubmission.trim()) return;
    try {
      const participant = participants.find(p => p.uid === user.uid);
      await addDoc(collection(db, `sessions/${sessionId}/submissions`), {
        sessionId,
        round: session.currentRound,
        uid: user.uid,
        name: participant?.name || '익명',
        description: mySubmission,
        votes: 0,
        aiFeedback: '',
      });
      setHasSubmitted(true);
      toast.success("묘사가 제출되었습니다!");
    } catch (error) {
      toast.error("제출 중 오류가 발생했습니다.");
    }
  };

  const handleVote = async (submissionId: string) => {
    if (hasVoted) return;
    try {
      await updateDoc(doc(db, `sessions/${sessionId}/submissions`, submissionId), {
        votes: increment(1)
      });
      setHasVoted(true);
      toast.success("투표가 완료되었습니다!");
    } catch (error) {
      toast.error("투표 중 오류가 발생했습니다.");
    }
  };

  const handleEndVoting = async () => {
    setIsGenerating(true);
    try {
      // Find winner
      const roundSubmissions = submissions.filter(s => s.round === session.currentRound);
      const winner = roundSubmissions.sort((a, b) => b.votes - a.votes)[0];

      if (!winner) {
        toast.error("제출된 묘사가 없습니다.");
        setIsGenerating(false);
        return;
      }

      // Generate AI Image
      const imageUrl = await generateImageFromDescription(winner.description);
      
      if (imageUrl) {
        await addDoc(collection(db, `sessions/${sessionId}/results`), {
          sessionId,
          round: session.currentRound,
          winningDescription: winner.description,
          winnerName: winner.name,
          generatedImageUrl: imageUrl,
        });

        // If not last round, provide AI feedback for the next round
        if (session.currentRound < session.rounds) {
          // Get feedback for all submissions to help them in the next round
          for (const sub of roundSubmissions) {
            const feedback = await getAIFeedback(session.artworkTitle, sub.description);
            await updateDoc(doc(db, `sessions/${sessionId}/submissions`, sub.id), {
              aiFeedback: feedback
            });
          }
        }

        await updateStatus('result');
      } else {
        toast.error("이미지 생성에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      toast.error("결과 처리 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNextRound = async () => {
    if (session.currentRound < session.rounds) {
      await updateDoc(doc(db, 'sessions', sessionId), {
        currentRound: increment(1),
        status: 'observing'
      });
    } else {
      await updateStatus('finished');
    }
  };

  const handleAddToHallOfFame = async () => {
    if (!currentRoundResult) return;
    try {
      await addDoc(collection(db, 'hallOfFame'), {
        artworkTitle: session.artworkTitle,
        description: currentRoundResult.winningDescription,
        studentName: currentRoundResult.winnerName,
        generatedImageUrl: currentRoundResult.generatedImageUrl,
        createdAt: serverTimestamp(),
      });
      toast.success("명예의 전당에 등록되었습니다!");
    } catch (error) {
      toast.error("등록 실패");
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.onstart = () => toast.info("음성 인식 중...");
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMySubmission(prev => prev + (prev ? ' ' : '') + transcript);
      toast.success("음성 인식 완료");
    };
    recognition.onerror = () => toast.error("음성 인식 오류");
    recognition.start();
  };

  const handleOCRInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      toast.info("손글씨 분석 중...");
      try {
        const text = await extractTextFromImage(base64);
        if (text) {
          setMySubmission(prev => prev + (prev ? ' ' : '') + text);
          toast.success("텍스트 추출 완료");
        } else {
          toast.error("텍스트를 추출할 수 없습니다.");
        }
      } catch (error) {
        toast.error("OCR 오류");
      }
    };
    reader.readAsDataURL(file);
  };

  if (!session) return null;

  const currentRoundResult = results.find(r => r.round === session.currentRound);
  const myCurrentSubmission = submissions.find(s => s.uid === user.uid && s.round === session.currentRound);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-serif font-bold tracking-tight">ACE CANVAS</h1>
          <Badge variant="secondary" className="font-mono">{session.code}</Badge>
        </div>
        <div className="flex items-center gap-4">
          {timeLeft !== null && (
            <div className={`flex items-center gap-2 px-4 py-1 rounded-full font-mono font-bold ${timeLeft < 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-stone-100 text-stone-600'}`}>
              <RefreshCw size={16} className={timeLeft < 10 ? 'animate-spin' : ''} />
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}
          <div className="flex items-center text-stone-500 text-sm">
            <Users size={16} className="mr-1" /> {participants.length}명 접속 중
          </div>
          <Button variant="ghost" size="sm" onClick={onExit}>
            <LogOut size={16} className="mr-2" /> 나가기
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* WAITING PHASE */}
          {session.status === 'waiting' && (
            <motion.div 
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-12 space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-serif">학생들을 기다리고 있습니다</h2>
                <p className="text-stone-500">아래 코드나 QR코드를 공유하여 학생들을 초대하세요.</p>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-xl border border-stone-100 flex flex-col items-center space-y-6">
                <div className="text-6xl font-mono font-bold tracking-[0.5em] text-stone-900 pl-[0.5em]">
                  {session.code}
                </div>
                <div className="p-4 bg-white border-8 border-stone-50 rounded-2xl">
                  <QRCodeSVG value={window.location.href} size={200} />
                </div>
                <Button variant="outline" onClick={() => {
                  navigator.clipboard.writeText(session.code);
                  toast.success("코드가 복사되었습니다.");
                }}>
                  <Share2 className="mr-2 h-4 w-4" /> 코드 복사하기
                </Button>
              </div>

              {isTeacher && (
                <Button 
                  size="lg" 
                  onClick={() => updateStatus('observing')}
                  className="h-16 px-12 text-xl font-serif rounded-2xl bg-stone-900 hover:bg-stone-800"
                >
                  <Play className="mr-2" /> 게임 시작하기
                </Button>
              )}
            </motion.div>
          )}

          {/* OBSERVING PHASE */}
          {session.status === 'observing' && (
            <motion.div 
              key="observing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <Badge className="bg-stone-100 text-stone-600 hover:bg-stone-100 border-none">ROUND {session.currentRound} / {session.rounds}</Badge>
                  <h2 className="text-3xl font-serif">작품을 깊이 관찰하세요</h2>
                </div>
                {isTeacher && (
                  <Button onClick={() => updateStatus('describing')} className="rounded-xl">
                    묘사 단계로 넘어가기 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="relative aspect-video bg-stone-200 rounded-3xl overflow-hidden shadow-2xl border-8 border-white">
                <img 
                  src={session.artworkUrl} 
                  alt={session.artworkTitle} 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-light">
                  {session.artworkTitle}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-stone-50 border-none rounded-2xl">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm"><Eye className="text-stone-600" /></div>
                    <div>
                      <h4 className="font-bold mb-1">색채와 빛</h4>
                      <p className="text-sm text-stone-500">어떤 색이 가장 눈에 띄나요? 빛은 어디서 오고 있나요?</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-stone-50 border-none rounded-2xl">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm"><PenTool className="text-stone-600" /></div>
                    <div>
                      <h4 className="font-bold mb-1">구도와 형태</h4>
                      <p className="text-sm text-stone-500">주인공은 어디에 있나요? 선의 느낌은 어떤가요?</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-stone-50 border-none rounded-2xl">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm"><Sparkles className="text-stone-600" /></div>
                    <div>
                      <h4 className="font-bold mb-1">감정과 분위기</h4>
                      <p className="text-sm text-stone-500">작품에서 어떤 기분이 느껴지나요? 작가는 무엇을 말하려 했을까요?</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* DESCRIBING PHASE */}
          {session.status === 'describing' && (
            <motion.div 
              key="describing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-serif">작품을 글로 묘사하세요</h2>
                  <p className="text-stone-500">관찰한 내용을 구체적이고 생생하게 표현해보세요.</p>
                </div>

                <div className="rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                  <img src={session.artworkUrl} alt="Artwork" className="w-full h-auto" referrerPolicy="no-referrer" />
                </div>
              </div>

              <div className="space-y-6">
                {!isTeacher ? (
                  <Card className="border-stone-200 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-stone-50 border-b border-stone-100">
                      <CardTitle className="font-serif">나의 묘사</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {session.currentRound > 1 && myCurrentSubmission?.aiFeedback && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-900 flex gap-3">
                          <Sparkles className="flex-shrink-0 h-5 w-5 text-amber-500" />
                          <div>
                            <span className="font-bold block mb-1">지난 라운드 AI 피드백:</span>
                            {myCurrentSubmission.aiFeedback}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleVoiceInput}
                          className="rounded-lg border-stone-200"
                        >
                          <Mic className="mr-2 h-4 w-4" /> 음성 인식
                        </Button>
                        <div className="relative">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-lg border-stone-200"
                          >
                            <FileText className="mr-2 h-4 w-4" /> 손글씨(OCR)
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleOCRInput}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </Button>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleGetFeedback}
                          disabled={isGettingFeedback || !mySubmission.trim()}
                          className="rounded-lg border-stone-200 text-stone-600"
                        >
                          <Sparkles className={`mr-2 h-4 w-4 ${isGettingFeedback ? 'animate-spin' : ''}`} /> AI 피드백
                        </Button>
                      </div>

                      {aiFeedback && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800 italic"
                        >
                          <p className="font-bold mb-1 flex items-center gap-1">
                            <Sparkles size={14} /> AI의 조언
                          </p>
                          {aiFeedback}
                        </motion.div>
                      )}

                      <Textarea 
                        placeholder="작품의 세부 사항, 색감, 구도 등을 자세히 적어주세요..."
                        className="min-h-[200px] text-lg rounded-xl border-stone-200 focus:ring-stone-900"
                        value={mySubmission}
                        onChange={(e) => setMySubmission(e.target.value)}
                        disabled={hasSubmitted}
                      />
                      <Button 
                        onClick={handleSubmitDescription} 
                        disabled={hasSubmitted || !mySubmission.trim()}
                        className="w-full h-14 text-lg font-serif rounded-xl bg-stone-900"
                      >
                        {hasSubmitted ? "제출 완료" : "묘사 제출하기"}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-serif text-xl">제출 현황 ({submissions.filter(s => s.round === session.currentRound).length} / {participants.length})</h3>
                      <Button onClick={() => updateStatus('voting')} className="rounded-xl">
                        투표 단계로 넘어가기 <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {participants.map(p => {
                        const submitted = submissions.some(s => s.uid === p.uid && s.round === session.currentRound);
                        return (
                          <div key={p.id} className={`p-3 rounded-xl border flex items-center gap-2 ${submitted ? 'bg-green-50 border-green-100 text-green-700' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>
                            <div className={`w-2 h-2 rounded-full ${submitted ? 'bg-green-500' : 'bg-stone-300'}`} />
                            <span className="text-sm font-medium">{p.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VOTING PHASE */}
          {session.status === 'voting' && (
            <motion.div 
              key="voting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h2 className="text-3xl font-serif">가장 잘 묘사한 글을 선택하세요</h2>
                  <p className="text-stone-500">작품을 가장 정확하고 깊이 있게 표현한 글에 투표하세요.</p>
                </div>
                {isTeacher && (
                  <Button onClick={handleEndVoting} disabled={isGenerating} className="rounded-xl bg-stone-900">
                    {isGenerating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Vote className="mr-2 h-4 w-4" />}
                    투표 종료 및 이미지 생성
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {submissions.filter(s => s.round === session.currentRound).map((sub) => (
                  <motion.div
                    key={sub.id}
                    whileHover={{ scale: 1.02 }}
                    className={`relative p-6 rounded-3xl border-2 transition-all cursor-pointer ${
                      hasVoted ? 'border-stone-100 bg-stone-50' : 'border-stone-200 hover:border-stone-900 bg-white'
                    }`}
                    onClick={() => !isTeacher && !hasVoted && handleVote(sub.id)}
                  >
                    <p className="text-stone-700 leading-relaxed mb-4 italic">"{sub.description}"</p>
                    <div className="flex justify-between items-center mt-auto">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-400">묘사 #{sub.id.substring(0,4)}</span>
                      <div className="flex items-center gap-1 text-stone-900 font-bold">
                        <Vote size={16} /> {sub.votes}
                      </div>
                    </div>
                    {hasVoted && (
                      <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] rounded-3xl" />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* RESULT PHASE */}
          {session.status === 'result' && currentRoundResult && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
                    <Trophy size={32} />
                  </div>
                </div>
                <h2 className="text-4xl font-serif">이번 라운드의 선정작</h2>
                <p className="text-stone-500 font-serif italic text-xl">"{currentRoundResult.winningDescription}"</p>
                <p className="text-stone-400">— {currentRoundResult.winnerName} 학생</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-center font-serif text-stone-400 uppercase tracking-widest">원본 작품</h3>
                  <div className="aspect-square bg-stone-100 rounded-3xl overflow-hidden border-8 border-white shadow-xl">
                    <img src={session.artworkUrl} alt="Original" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-center font-serif text-stone-400 uppercase tracking-widest">AI 생성 이미지</h3>
                  <div className="aspect-square bg-stone-100 rounded-3xl overflow-hidden border-8 border-white shadow-xl relative">
                    <img src={currentRoundResult.generatedImageUrl} alt="AI Generated" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-stone-900/50 backdrop-blur-md text-white border-none">AI GENERATED</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-stone-900 text-stone-50 p-8 rounded-3xl shadow-2xl space-y-4">
                <h4 className="text-xl font-serif flex items-center gap-2">
                  <Sparkles className="text-amber-400" /> 감상 비교하기
                </h4>
                <p className="text-stone-300 leading-relaxed">
                  AI가 생성한 이미지는 원본 작품과 어떻게 다른가요? 묘사에서 강조된 부분이 어떻게 시각화되었는지 살펴보세요. 
                  다음 라운드에서는 더 구체적인 질감, 빛의 방향, 그리고 작가의 의도를 담은 표현을 시도해보세요.
                </p>
                {isTeacher && (
                  <div className="pt-4 flex justify-center gap-4">
                    <Button 
                      onClick={handleAddToHallOfFame} 
                      variant="outline"
                      size="lg" 
                      className="border-white text-white hover:bg-white/10 rounded-xl px-8"
                    >
                      <Trophy className="mr-2 text-amber-400" /> 명예의 전당 등록
                    </Button>
                    <Button 
                      onClick={handleNextRound} 
                      size="lg" 
                      className="bg-white text-stone-900 hover:bg-stone-100 rounded-xl px-12"
                    >
                      {session.currentRound < session.rounds ? "다음 라운드 시작" : "최종 결과 보기"} <ArrowRight className="ml-2" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* FINISHED PHASE */}
          {session.status === 'finished' && (
            <motion.div 
              key="finished"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-serif">감상 수업이 종료되었습니다</h2>
                <p className="text-stone-500 text-xl">작품을 깊이 있게 바라본 여러분 모두가 예술가입니다.</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                {results.map((res, i) => (
                  <div key={i} className="space-y-2">
                    <div className="aspect-square rounded-xl overflow-hidden border-2 border-stone-100">
                      <img src={res.generatedImageUrl} alt={`Round ${res.round}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <p className="text-xs text-center text-stone-400 font-serif">ROUND {res.round}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <Button onClick={onExit} variant="outline" className="rounded-xl px-12 h-14">
                  메인 화면으로 돌아가기
                </Button>
                {isTeacher && (
                  <Button 
                    onClick={() => toast.info("명예의 전당은 각 라운드 결과에서 등록할 수 있습니다.")} 
                    variant="ghost" 
                    className="rounded-xl px-8 h-14"
                  >
                    <Trophy className="mr-2 h-4 w-4" /> 명예의 전당 안내
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
