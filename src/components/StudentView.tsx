import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { signInAnonymously, updateProfile, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'motion/react';
import { ArrowLeft, LogIn } from 'lucide-react';
import { toast } from 'sonner';

interface StudentViewProps {
  user: User | null;
  onEnterGame: (sessionId: string) => void;
  onBack: () => void;
}

export function StudentView({ user, onEnterGame, onBack }: StudentViewProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!code || !name) {
      toast.error("접속 코드와 닉네임을 입력해주세요.");
      return;
    }

    setIsJoining(true);
    try {
      // 1. Sign in anonymously if not already
      let currentUser = user;
      if (!currentUser) {
        const userCredential = await signInAnonymously(auth);
        currentUser = userCredential.user;
      }
      
      // 2. Update profile with nickname
      await updateProfile(currentUser!, { displayName: name });

      // 3. Find session
      const q = query(collection(db, 'sessions'), where('code', '==', code.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error("유효하지 않은 코드입니다.");
        return;
      }

      const sessionDoc = querySnapshot.docs[0];
      const sessionId = sessionDoc.id;

      // 4. Add participant
      await addDoc(collection(db, `sessions/${sessionId}/participants`), {
        uid: currentUser!.uid,
        name,
        sessionId,
      });

      toast.success("게임에 참여했습니다!");
      onEnterGame(sessionId);
    } catch (error) {
      console.error(error);
      toast.error("참여 중 오류가 발생했습니다.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-24 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button variant="ghost" onClick={onBack} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> 돌아가기
        </Button>

        <Card className="border-stone-200 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-stone-900 text-stone-50 p-8">
            <CardTitle className="text-3xl font-serif">참여하기</CardTitle>
            <CardDescription className="text-stone-400">교사에게 받은 코드를 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code">접속 코드</Label>
              <Input 
                id="code"
                placeholder="ABCDEF" 
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="h-14 text-2xl text-center font-mono tracking-widest rounded-xl border-stone-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">나의 이름</Label>
              <Input 
                id="name"
                placeholder="이름을 입력하세요" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-14 text-lg rounded-xl border-stone-200"
              />
            </div>

            <Button 
              onClick={handleJoin} 
              disabled={isJoining}
              className="w-full h-14 text-lg font-serif rounded-xl bg-stone-900 hover:bg-stone-800 transition-all active:scale-95"
            >
              {isJoining ? "참여 중..." : <><LogIn className="mr-2 h-5 w-5" /> 입장하기</>}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
