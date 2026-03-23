import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, GraduationCap, UserCog, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const roleConfig = {
  student: { label: 'Student', icon: GraduationCap, color: 'bg-primary' },
  admin: { label: 'Admin', icon: UserCog, color: 'bg-accent' },
  security: { label: 'Security', icon: Shield, color: 'bg-warning' },
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(0);
  const config = role ? roleConfig[role] : null;
  const Icon = config?.icon ?? GraduationCap;

  useEffect(() => {
    if (role !== 'student') return;
    // Count unread (recent) notifications - passes updated in last hour
    const checkNotifications = async () => {
      const { count } = await supabase
        .from('pass_requests')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'pending')
        .gte('updated_at', new Date(Date.now() - 3600000).toISOString());
      setNotifications(count ?? 0);
    };
    checkNotifications();
  }, [role]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config?.color}`}>
              <Icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold leading-tight">CampusPass</h1>
              <p className="text-xs text-muted-foreground">{config?.label} Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {role === 'student' && notifications > 0 && (
              <div className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {notifications}
                </span>
              </div>
            )}
            <span className="hidden text-sm font-medium sm:inline">{profile?.full_name}</span>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
