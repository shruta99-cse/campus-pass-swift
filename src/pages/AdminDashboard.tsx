import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import AnimatedStatCard from '@/components/AnimatedStatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, FileText, Users, Search } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type PassRequest = Tables<'pass_requests'>;

interface PassWithStudent extends PassRequest {
  profiles?: { full_name: string; email: string; student_id: string | null } | null;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const [passes, setPasses] = useState<PassWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPass, setSelectedPass] = useState<PassWithStudent | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPasses = async () => {
    let query = supabase
      .from('pass_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as any);
    }

    const { data } = await query;
    if (!data) { setPasses([]); setLoading(false); return; }

    const studentIds = [...new Set(data.map(p => p.student_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, student_id')
      .in('id', studentIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    setPasses(data.map(p => ({ ...p, profiles: profileMap.get(p.student_id) || null })));
    setLoading(false);
  };

  useEffect(() => { fetchPasses(); }, [statusFilter]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-passes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pass_requests' }, () => {
        toast.info('New pass request received!');
        fetchPasses();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAction = async (passId: string, status: 'approved' | 'rejected') => {
    setActionLoading(true);
    const { error } = await supabase
      .from('pass_requests')
      .update({ status, admin_remarks: remarks || null, reviewed_by: user?.id })
      .eq('id', passId);

    setActionLoading(false);
    if (error) { toast.error(error.message); }
    else {
      toast.success(`Pass ${status}!`);
      setSelectedPass(null);
      setRemarks('');
      fetchPasses();
    }
  };

  const filteredPasses = passes.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.profiles?.full_name?.toLowerCase().includes(q) ||
      p.profiles?.email?.toLowerCase().includes(q) ||
      p.destination.toLowerCase().includes(q) ||
      p.reason.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: passes.length,
    pending: passes.filter(p => p.status === 'pending').length,
    approved: passes.filter(p => p.status === 'approved').length,
    rejected: passes.filter(p => p.status === 'rejected').length,
  };

  const statusBadge = (status: string) => {
    const config: Record<string, string> = {
      pending: 'bg-warning/10 text-warning border-warning/20',
      approved: 'bg-success/10 text-success border-success/20',
      rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return config[status] || '';
  };

  const statItems = [
    { label: 'Total Requests', value: stats.total, icon: FileText, color: 'bg-primary/10 text-primary', filter: 'all' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-warning/10 text-warning', filter: 'pending' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'bg-success/10 text-success', filter: 'approved' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-destructive/10 text-destructive', filter: 'rejected' },
  ];

  return (
    <DashboardLayout>
      {/* Stats - clickable to filter */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statItems.map((item, i) => (
          <AnimatedStatCard
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            color={item.color}
            active={statusFilter === item.filter}
            onClick={() => setStatusFilter(item.filter)}
            delay={i}
          />
        ))}
      </div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-4"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student, destination, reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </motion.div>

      {/* Pass list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredPasses.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No pass requests found.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {filteredPasses.map((pass, i) => (
              <motion.div
                key={pass.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                whileHover={{ x: 4 }}
              >
                <Card
                  className="glass-card cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
                  onClick={() => { setSelectedPass(pass); setRemarks(''); }}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{pass.profiles?.full_name || 'Unknown'}</h3>
                          <Badge variant="outline" className={statusBadge(pass.status)}>
                            {pass.status.charAt(0).toUpperCase() + pass.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{pass.destination} · {pass.pass_date}</p>
                        <p className="text-xs text-muted-foreground">{pass.reason}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {pass.departure_time} – {pass.return_time}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedPass} onOpenChange={() => setSelectedPass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Pass Request Details</DialogTitle>
          </DialogHeader>
          {selectedPass && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Student:</span> <span className="font-medium">{selectedPass.profiles?.full_name}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{selectedPass.profiles?.email}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{selectedPass.pass_date}</span></div>
                <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{selectedPass.departure_time} – {selectedPass.return_time}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Destination:</span> <span className="font-medium">{selectedPass.destination}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Reason:</span> <span className="font-medium">{selectedPass.reason}</span></div>
              </div>
              {selectedPass.status === 'pending' && (
                <>
                  <Textarea
                    placeholder="Add remarks (optional)"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        className="w-full bg-success hover:bg-success/90 text-success-foreground"
                        onClick={() => handleAction(selectedPass.id, 'approved')}
                        disabled={actionLoading}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" /> Approve
                      </Button>
                    </motion.div>
                    <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleAction(selectedPass.id, 'rejected')}
                        disabled={actionLoading}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </motion.div>
                  </div>
                </>
              )}
              {selectedPass.admin_remarks && (
                <p className="text-sm italic text-muted-foreground">Remarks: {selectedPass.admin_remarks}</p>
              )}
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminDashboard;
