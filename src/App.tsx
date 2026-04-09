import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LandingPage } from './components/LandingPage';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentView } from './components/StudentView';
import { GameRoom } from './components/GameRoom';
import { HallOfFame } from './components/HallOfFame';
import { TeacherAuth } from './components/TeacherAuth';
import { Toaster } from '@/components/ui/sonner';
import { motion, AnimatePresence } from 'motion/react';

export type ViewState = 'landing' | 'teacher-auth' | 'teacher-dash' | 'student-login' | 'game' | 'hall-of-fame';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>('landing');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEnterGame = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setView('game');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200">
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <LandingPage 
            onTeacher={() => setView('teacher-auth')} 
            onStudent={() => setView('student-login')} 
            onHallOfFame={() => setView('hall-of-fame')}
          />
        )}
        {view === 'teacher-auth' && (
          <TeacherAuth 
            onSuccess={() => setView('teacher-dash')}
            onBack={() => setView('landing')}
          />
        )}
        {view === 'teacher-dash' && (
          <TeacherDashboard 
            user={user!} 
            onEnterGame={handleEnterGame}
            onBack={() => setView('landing')}
          />
        )}
        {view === 'student-login' && (
          <StudentView 
            user={user} 
            onEnterGame={handleEnterGame}
            onBack={() => setView('landing')}
          />
        )}
        {view === 'game' && activeSessionId && (
          <GameRoom 
            user={user!} 
            sessionId={activeSessionId}
            onExit={() => {
              setActiveSessionId(null);
              setView('landing');
            }}
          />
        )}
        {view === 'hall-of-fame' && (
          <HallOfFame 
            onBack={() => setView('landing')}
          />
        )}
      </AnimatePresence>
      <Toaster position="top-center" />
    </div>
  );
}
