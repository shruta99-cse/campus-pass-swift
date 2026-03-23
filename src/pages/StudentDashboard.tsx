import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import AnimatedStatCard from '@/components/AnimatedStatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Plus, Clock, CheckCircle, XCircle, FileText, ChevronDown, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Tables } from '@/integrations/supabase/types';

type PassRequest = Tables<'pass_requests'>;

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' },
  approved: { label: 'Approved', icon: CheckCircle, className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const [passes, setPasses] = useState<PassRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [form, setForm] = useState({
    pass_date: '',
    departure_time: '',
    return_time: '',
    reason: '',
    destination: '',
  });

  const fetchPasses = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pass_requests')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });
    setPasses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPasses();
    const channel = supabase
      .channel('student-passes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pass_requests',
        filter: `student_id=eq.${user?.id}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as PassRequest;
          setPasses(prev => prev.map(p => p.id === updated.id ? updated : p));
          if (updated.status === 'approved') toast.success('Your pass has been approved! 🎉');
          else if (updated.status === 'rejected') toast.error('Your pass was rejected.');
        } else if (payload.eventType === 'INSERT') {
          setPasses(prev => [payload.new as PassRequest, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const passId = crypto.randomUUID();
    const qrData = JSON.stringify({ passId, studentId: user.id });
    const { error } = await supabase.from('pass_requests').insert({
      id: passId, student_id: user.id, ...form, qr_code: qrData,
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success('Pass request submitted!');
      setDialogOpen(false);
      setForm({ pass_date: '', departure_time: '', return_time: '', reason: '', destination: '' });
      fetchPasses();
    }
  };

  const stats = {
    total: passes.length,
    pending: passes.filter(p => p.status === 'pending').length,
    approved: passes.filter(p => p.status === 'approved').length,
    rejected: passes.filter(p => p.status === 'rejected').length,
  };

  const filteredPasses = activeTab === 'all' ? passes : passes.filter(p => p.status === activeTab);

  return (
    <DashboardLayout>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnimatedStatCard label="Total" value={stats.total} icon={FileText} color="bg-primary/10 text-primary" delay={0} />
        <AnimatedStatCard label="Pending" value={stats.pending} icon={Clock} color="bg-warning/10 text-warning" delay={1} />
        <AnimatedStatCard label="Approved" value={stats.approved} icon={CheckCircle} color="bg-success/10 text-success" delay={2} />
        <AnimatedStatCard label="Rejected" value={stats.rejected} icon={XCircle} color="bg-destructive/10 text-destructive" delay={3} />
      </div>

      {/* Header + Apply */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold">My Passes</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button><Plus className="mr-2 h-4 w-4" /> Apply for Pass</Button>
            </motion.div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> New Pass Request
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.pass_date} onChange={e => setForm(f => ({ ...f, pass_date: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Departure Time</Label>
                  <Input type="time" value={form.departure_time} onChange={e => setForm(f => ({ ...f, departure_time: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Return Time</Label>
                  <Input type="time" value={form.return_time} onChange={e => setForm(f => ({ ...f, return_time: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <Input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. City Hospital" required />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why do you need a pass?" required />
              </div>
              <Button type="submit" className="w-full">Submit Request</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Pass list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredPasses.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {activeTab === 'all' ? 'No pass requests yet. Click "Apply for Pass" to get started.' : `No ${activeTab} passes.`}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {filteredPasses.map((pass, i) => {
              const config = statusConfig[pass.status];
              const StatusIcon = config.icon;
              const isExpanded = expandedId === pass.id;
              return (
                <motion.div
                  key={pass.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : pass.id)}>
                    <Card className={`glass-card transition-all ${isExpanded ? 'ring-1 ring-primary/30 shadow-lg' : 'hover:shadow-md'}`}>
                      <CollapsibleTrigger className="w-full text-left">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{pass.destination}</h3>
                                <Badge variant="outline" className={config.className}>
                                  <StatusIcon className="mr-1 h-3 w-3" />
                                  {config.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {pass.pass_date} · {pass.departure_time} – {pass.return_time}
                              </p>
                            </div>
                            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </motion.div>
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-t border-border px-4 pb-4 pt-3"
                        >
                          <p className="text-sm text-muted-foreground mb-2">{pass.reason}</p>
                          {pass.admin_remarks && (
                            <p className="text-sm italic text-muted-foreground mb-3">
                              💬 Admin remarks: {pass.admin_remarks}
                            </p>
                          )}
                          {pass.status === 'approved' && pass.qr_code && (
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="inline-block rounded-lg border border-border bg-card p-3"
                            >
                              <QRCodeSVG value={pass.qr_code} size={120} />
                              <p className="mt-1 text-center text-[10px] text-muted-foreground">Show at gate</p>
                            </motion.div>
                          )}
                        </motion.div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </DashboardLayout>
  );
};

export default StudentDashboard;
