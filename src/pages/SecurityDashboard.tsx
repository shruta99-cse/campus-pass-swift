import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScanLine, CheckCircle, XCircle, Search } from 'lucide-react';
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

  const handleVerify = async (id?: string) => {
    const idToVerify = id || passId;
    if (!idToVerify.trim()) {
      toast.error('Please enter a pass ID');
      return;
    }

    setVerifying(true);
    setVerifiedPass(null);

    // Try to parse as QR JSON
    let actualId = idToVerify;
    try {
      const parsed = JSON.parse(idToVerify);
      if (parsed.passId) actualId = parsed.passId;
    } catch {
      // Not JSON, use as-is
    }

    const { data, error } = await supabase
      .from('pass_requests')
      .select('*')
      .eq('id', actualId)
      .single();

    setVerifying(false);

    if (error || !data) {
      toast.error('Pass not found!');
      return;
    }

    // Fetch the student profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email, student_id')
      .eq('id', data.student_id)
      .single();

    const passData: VerifiedPass = { ...data, profiles: profileData };
    setVerifiedPass(passData);
    setRecentScans(prev => [passData, ...prev.filter(p => p.id !== passData.id)].slice(0, 10));

    if (passData.status === 'approved') {
      toast.success('Pass is VALID ✓');
    } else {
      toast.error(`Pass is ${passData.status.toUpperCase()}`);
    }
  };

  const isPassValid = (pass: VerifiedPass) => {
    if (pass.status !== 'approved') return false;
    const today = new Date().toISOString().split('T')[0];
    return pass.pass_date === today;
  };

  return (
    <DashboardLayout>
      {/* Scanner */}
      <Card className="glass-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <ScanLine className="h-5 w-5 text-primary" />
            Verify Pass
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter Pass ID or scan QR code data..."
              value={passId}
              onChange={e => setPassId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              className="flex-1"
            />
            <Button onClick={() => handleVerify()} disabled={verifying}>
              <Search className="mr-2 h-4 w-4" />
              {verifying ? 'Checking...' : 'Verify'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Verification Result */}
      {verifiedPass && (
        <Card className={`mb-6 animate-fade-in border-2 ${
          isPassValid(verifiedPass) 
            ? 'border-success bg-success/5' 
            : 'border-destructive bg-destructive/5'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                isPassValid(verifiedPass) ? 'bg-success' : 'bg-destructive'
              }`}>
                {isPassValid(verifiedPass) ? (
                  <CheckCircle className="h-8 w-8 text-success-foreground" />
                ) : (
                  <XCircle className="h-8 w-8 text-destructive-foreground" />
                )}
              </div>
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
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Student:</span> <span className="font-medium">{verifiedPass.profiles?.full_name}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{verifiedPass.profiles?.email}</span></div>
                  <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{verifiedPass.pass_date}</span></div>
                  <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{verifiedPass.departure_time} – {verifiedPass.return_time}</span></div>
                  <div><span className="text-muted-foreground">Destination:</span> <span className="font-medium">{verifiedPass.destination}</span></div>
                  <div><span className="text-muted-foreground">Reason:</span> <span className="font-medium">{verifiedPass.reason}</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <>
          <h2 className="mb-3 font-heading text-lg font-bold">Recent Scans</h2>
          <div className="space-y-2">
            {recentScans.map(scan => (
              <Card
                key={scan.id}
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
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default SecurityDashboard;
