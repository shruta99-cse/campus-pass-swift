import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  active?: boolean;
  onClick?: () => void;
  delay?: number;
}

const AnimatedStatCard = ({ label, value, icon: Icon, color, active, onClick, delay = 0 }: Props) => {
  const animatedValue = useAnimatedCounter(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <Card
        className={`glass-card transition-all cursor-pointer ${
          active ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
        }`}
        onClick={onClick}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <motion.div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
            animate={active ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.5, repeat: active ? Infinity : 0, repeatDelay: 2 }}
          >
            <Icon className="h-5 w-5" />
          </motion.div>
          <div>
            <p className="text-2xl font-bold font-heading">{animatedValue}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AnimatedStatCard;
