import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Palette, GraduationCap, Users, Trophy, Info } from 'lucide-react';

interface LandingPageProps {
  onTeacher: () => void;
  onStudent: () => void;
  onHallOfFame: () => void;
}

export function LandingPage({ onTeacher, onStudent, onHallOfFame }: LandingPageProps) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-stone-200 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-stone-200 rounded-full blur-3xl opacity-30" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center z-10 max-w-3xl"
      >
        <div className="flex justify-center mb-8">
          <motion.div 
            whileHover={{ rotate: 5, scale: 1.05 }}
            className="p-5 bg-stone-900 text-stone-50 rounded-3xl shadow-2xl"
          >
            <Palette size={56} />
          </motion.div>
        </div>
        
        <h1 className="text-7xl md:text-9xl font-serif font-light tracking-tight mb-6">
          ACE <span className="italic">CANVAS</span>
        </h1>
        
        <div className="space-y-4 mb-12">
          <p className="text-stone-600 text-xl md:text-2xl font-light leading-relaxed">
            AI와 함께하는 실시간 미술 감상 게임
          </p>
          <p className="text-stone-400 text-base md:text-lg max-w-xl mx-auto font-light">
            명화를 관찰하고 당신의 언어로 묘사하세요. 
            AI가 당신의 설명을 바탕으로 새로운 예술을 창조합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Button 
            onClick={onTeacher}
            className="h-20 text-xl font-serif rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-50 transition-all hover:shadow-lg"
          >
            <GraduationCap className="mr-3" /> 교사로 시작하기
          </Button>
          <Button 
            onClick={onStudent}
            variant="outline"
            className="h-20 text-xl font-serif rounded-2xl border-2 border-stone-900 hover:bg-stone-100 transition-all hover:shadow-lg"
          >
            <Users className="mr-3" /> 학생으로 참여하기
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Button 
            variant="ghost" 
            onClick={onHallOfFame}
            className="rounded-xl text-stone-500 hover:text-stone-900"
          >
            <Trophy className="mr-2 h-4 w-4" /> 명예의 전당
          </Button>
          <Button 
            variant="ghost" 
            className="rounded-xl text-stone-500 hover:text-stone-900"
          >
            <Info className="mr-2 h-4 w-4" /> 게임 설명
          </Button>
        </div>
      </motion.div>

      <footer className="mt-16 text-stone-400 text-sm font-light z-10">
        © 2026 ACE CANVAS. All rights reserved.
      </footer>
    </div>
  );
}
