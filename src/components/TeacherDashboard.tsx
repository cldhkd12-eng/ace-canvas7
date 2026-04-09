import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { motion } from 'motion/react';
import { ArrowLeft, Play, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TeacherDashboardProps {
  user: User;
  onEnterGame: (sessionId: string) => void;
  onBack: () => void;
}

const SAMPLE_ARTWORKS = [
  { title: "별이 빛나는 밤 (The Starry Night)", url: "https://picsum.photos/seed/starry/800/600" },
  { title: "진주 귀걸이를 한 소녀 (Girl with a Pearl Earring)", url: "https://picsum.photos/seed/pearl/800/600" },
  { title: "기억의 지속 (The Persistence of Memory)", url: "https://picsum.photos/seed/memory/800/600" },
];

export function TeacherDashboard({ user, onEnterGame, onBack }: TeacherDashboardProps) {
  const [artworkUrl, setArtworkUrl] = useState('');
  const [artworkTitle, setArtworkTitle] = useState('');
  const [rounds, setRounds] = useState(3);
  const [timeLimit, setTimeLimit] = useState(60); // Default 60 seconds
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload-artwork', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.url) {
        setArtworkUrl(data.url);
        toast.success("이미지가 업로드 및 최적화되었습니다.");
      }
    } catch (error) {
      toast.error("이미지 업로드 실패");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateGame = async () => {
    if (!artworkUrl || !artworkTitle) {
      toast.error("작품 정보와 제목을 입력해주세요.");
      return;
    }

    setIsCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const docRef = await addDoc(collection(db, 'sessions'), {
        code,
        teacherId: user.uid,
        artworkUrl,
        artworkTitle,
        rounds,
        timeLimit,
        currentRound: 1,
        status: 'waiting',
        createdAt: serverTimestamp(),
      });
      toast.success("게임이 생성되었습니다!");
      onEnterGame(docRef.id);
    } catch (error) {
      console.error(error);
      toast.error("게임 생성 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> 돌아가기
        </Button>
        <h2 className="text-4xl font-serif font-light">교사 대시보드</h2>
        <p className="text-stone-500">새로운 감상 수업을 설계하세요.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-2 border-stone-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-stone-50 border-b border-stone-100">
            <CardTitle className="font-serif">게임 설정</CardTitle>
            <CardDescription>감상할 작품과 진행 방식을 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">작품 제목</Label>
              <Input 
                id="title"
                placeholder="예: 별이 빛나는 밤" 
                value={artworkTitle}
                onChange={(e) => setArtworkTitle(e.target.value)}
                className="rounded-xl border-stone-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">작품 이미지 업로드</Label>
              <div className="flex gap-2">
                <Input 
                  id="file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="rounded-xl border-stone-200 cursor-pointer"
                />
                {isUploading && <RefreshCw className="animate-spin h-10 w-10 text-stone-400" />}
              </div>
              <p className="text-xs text-stone-400">이미지는 자동으로 최적화되어 저장됩니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>진행 라운드 수</Label>
                  <span className="font-serif italic">{rounds} 라운드</span>
                </div>
                <Slider 
                  value={[rounds]} 
                  onValueChange={(v) => setRounds(v[0])} 
                  max={10} 
                  min={1} 
                  step={1}
                  className="py-4"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>라운드당 제한 시간</Label>
                  <span className="font-serif italic">{timeLimit}초</span>
                </div>
                <Slider 
                  value={[timeLimit]} 
                  onValueChange={(v) => setTimeLimit(v[0])} 
                  max={300} 
                  min={30} 
                  step={10}
                  className="py-4"
                />
              </div>
            </div>

            <Button 
              onClick={handleCreateGame} 
              disabled={isCreating}
              className="w-full h-14 text-lg font-serif rounded-xl bg-stone-900 hover:bg-stone-800"
            >
              {isCreating ? "생성 중..." : <><Play className="mr-2 h-5 w-5" /> 게임 시작하기</>}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-stone-200 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-serif uppercase tracking-wider text-stone-400">추천 작품</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {SAMPLE_ARTWORKS.map((art, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setArtworkUrl(art.url);
                    setArtworkTitle(art.title);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-stone-100 hover:border-stone-300 hover:bg-stone-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-stone-200 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={art.url} alt={art.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-sm font-medium line-clamp-2 group-hover:text-stone-900 transition-colors">{art.title}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {artworkUrl && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl overflow-hidden border-4 border-white shadow-lg"
            >
              <img src={artworkUrl} alt="Preview" className="w-full h-auto" referrerPolicy="no-referrer" />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
