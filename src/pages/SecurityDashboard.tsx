import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScanLine, CheckCircle, XCircle, Search, Shield, Clock } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type PassRequest = Tables<'pass_requests'>;

interface VerifiedPass extends PassRequest {
  profiles?: { full_name: string; email: string; student_id: string | null } | null;
}

const SecurityDashboard = () => {
  const [passId, setPassId] = useState('');
  const [verifiedPass, setVerifiedPass] = useState<VerifiedPass | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [recentScans, setRecentScans] = useState<VerifiedPass[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (id?: string) => {
    const idToVerify = id || passId;
    if (!idToVerify.trim()) { toast.error('Please enter a pass ID'); return; }

    setVerifying(true);
    setVerifiedPass(null);

    let actualId = idToVerify;
    try { const parsed = JSON.parse(idToVerify); if (parsed.passId) actualId = parsed.passId; } catch {}

    const { data, error } = await supabase
      .from('pass_requests')
      .select('*')
      .eq('id', actualId)
      .single();

    setVerifying(false);

    if (error || !data) { toast.error('Pass not found!'); return; }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email, student_id')
      .eq('id', data.student_id)
      .single();

    const passData: VerifiedPass = { ...data, profiles: profileData };
    setVerifiedPass(passData);
    setRecentScans(prev => [passData, ...prev.filter(p => p.id !== passData.id)].slice(0, 10));

    if (passData.status === 'approved') toast.success('Pass is VALID ✓');
    else toast.error(`Pass is ${passData.status.toUpperCase()}`);
  };

  const isPassValid = (pass: VerifiedPass) => {
    if (pass.status !== 'approved') return false;
    const today = new Date().toISOString().split('T')[0];
    return pass.pass_date === today;
  };

  const scanCount = recentScans.length;
  const validCount = recentScans.filter(s => isPassValid(s)).length;

  return (
    <DashboardLayout>
      {/* Live clock + stats bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/50 p-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-heading font-bold">
              {currentTime.toLocaleTimeString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-xl font-bold font-heading text-primary">{scanCount}</p>
            <p className="text-xs text-muted-foreground">Scans</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold font-heading text-success">{validCount}</p>
            <p className="text-xs text-muted-foreground">Valid</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold font-heading text-destructive">{scanCount - validCount}</p>
            <p className="text-xs text-muted-foreground">Invalid</p>
          </div>
        </div>
      </motion.div>

      {/* Scanner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <ScanLine className="h-5 w-5 text-primary" />
              </motion.div>
              Verify Pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter Pass ID or scan QR code data..."
                  value={passId}
                  onChange={e => setPassId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  className="pl-9"
                />
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button onClick={() => handleVerify()} disabled={verifying}>
                  {verifying ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Clock className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <ScanLine className="mr-2 h-4 w-4" />
                  )}
                  {verifying ? 'Checking...' : 'Verify'}
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Verification Result */}
      <AnimatePresence mode="wait">
        {verifiedPass && (
          <motion.div
            key={verifiedPass.id + verifiedPass.status}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <Card className={`mb-6 border-2 ${
              isPassValid(verifiedPass) ? 'border-success bg-success/5' : 'border-destructive bg-destructive/5'
            }`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <motion.div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                      isPassValid(verifiedPass) ? 'bg-success' : 'bg-destructive'
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.5 }}
                  >
                    {isPassValid(verifiedPass) ? (
                      <CheckCircle className="h-8 w-8 text-success-foreground" />
                    ) : (
                      <XCircle className="h-8 w-8 text-destructive-foreground" />
                    )}
                  </motion.div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-heading font-bold">
                        {isPassValid(verifiedPass) ? 'PASS VALID' : 'PASS INVALID'}
                      </h2>
                      <Badge variant="outline" className={
                        verifiedPass.status === 'approved'
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                      }>
                        {verifiedPass.status.toUpperCase()}
                      </Badge>
                    </div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm"
                    >
                      <div><span className="text-muted-foreground">Student:</span> <span className="font-medium">{verifiedPass.profiles?.full_name}</span></div>
                      <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{verifiedPass.profiles?.email}</span></div>
                      <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{verifiedPass.pass_date}</span></div>
                      <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{verifiedPass.departure_time} – {verifiedPass.return_time}</span></div>
                      <div><span className="text-muted-foreground">Destination:</span> <span className="font-medium">{verifiedPass.destination}</span></div>
                      <div><span className="text-muted-foreground">Reason:</span> <span className="font-medium">{verifiedPass.reason}</span></div>
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h2 className="mb-3 font-heading text-lg font-bold">Recent Scans</h2>
          <div className="space-y-2">
            <AnimatePresence>
              {recentScans.map((scan, i) => (
                <motion.div
                  key={scan.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ x: 4 }}
                >
                  <Card
                    className="glass-card cursor-pointer transition-all hover:shadow-md"
                    onClick={() => { setPassId(scan.id); handleVerify(scan.id); }}
                  >
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        {scan.status === 'approved' ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{scan.profiles?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{scan.destination} · {scan.pass_date}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={
                        scan.status === 'approved'
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                      }>
                        {scan.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </DashboardLayout>
  );
};

export default SecurityDashboard;
