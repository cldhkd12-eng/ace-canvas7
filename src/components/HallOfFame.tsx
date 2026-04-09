import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'motion/react';
import { ArrowLeft, Trophy, Calendar } from 'lucide-react';

interface HallOfFameProps {
  onBack: () => void;
}

export function HallOfFame({ onBack }: HallOfFameProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'hallOfFame'), orderBy('createdAt', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-12 flex justify-between items-end"
      >
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> 돌아가기
          </Button>
          <h2 className="text-5xl font-serif font-light flex items-center gap-4">
            <Trophy className="text-amber-500" size={48} /> 명예의 전당
          </h2>
          <p className="text-stone-500 mt-2">ACE CANVAS에서 탄생한 최고의 예술 작품들을 감상하세요.</p>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-96 bg-stone-100 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden group">
                <div className="aspect-square overflow-hidden relative">
                  <img 
                    src={entry.generatedImageUrl} 
                    alt={entry.artworkTitle} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                    <p className="text-white text-sm italic font-light">"{entry.description}"</p>
                  </div>
                </div>
                <CardContent className="p-6 space-y-3">
                  <h3 className="text-xl font-serif font-bold">{entry.artworkTitle}</h3>
                  <div className="flex justify-between items-center text-sm text-stone-500">
                    <span className="font-medium text-stone-900">Artist: {entry.studentName}</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(entry.createdAt?.toDate()).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-24 text-stone-400">
          <p>아직 등록된 작품이 없습니다. 첫 번째 주인공이 되어보세요!</p>
        </div>
      )}
    </div>
  );
}
