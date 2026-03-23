import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, FileText, Users, Filter } from 'lucide-react';
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

    // Fetch profiles for all student IDs
    const studentIds = [...new Set(data.map(p => p.student_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, student_id')
      .in('id', studentIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const withStudents: PassWithStudent[] = data.map(p => ({
      ...p,
      profiles: profileMap.get(p.student_id) || null,
    }));
    setPasses(withStudents);
    setLoading(false);
  };

  useEffect(() => {
    fetchPasses();
  }, [statusFilter]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-passes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pass_requests',
      }, () => {
        toast.info('New pass request received!');
        fetchPasses();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAction = async (passId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('pass_requests')
      .update({
        status,
        admin_remarks: remarks || null,
        reviewed_by: user?.id,
      })
      .eq('id', passId);

    if (error) {
      toast.error(error.message);
    } else {
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

  return (
    <DashboardLayout>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Requests', value: stats.total, icon: FileText, color: 'bg-primary/10 text-primary' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-warning/10 text-warning' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'bg-success/10 text-success' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-destructive/10 text-destructive' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="glass-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Search by student, destination, reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pass list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredPasses.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No pass requests found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPasses.map(pass => (
            <Card
              key={pass.id}
              className="glass-card cursor-pointer transition-all hover:shadow-md"
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
                    <p className="text-sm text-muted-foreground">
                      {pass.destination} · {pass.pass_date}
                    </p>
                    <p className="text-xs text-muted-foreground">{pass.reason}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {pass.departure_time} – {pass.return_time}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedPass} onOpenChange={() => setSelectedPass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Pass Request Details</DialogTitle>
          </DialogHeader>
          {selectedPass && (
            <div className="space-y-4">
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
                    <Button
                      className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                      onClick={() => handleAction(selectedPass.id, 'approved')}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleAction(selectedPass.id, 'rejected')}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </>
              )}
              {selectedPass.admin_remarks && (
                <p className="text-sm italic text-muted-foreground">Remarks: {selectedPass.admin_remarks}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminDashboard;
