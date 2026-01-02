import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate, NavLink } from 'react-router-dom';
import { adminAuth } from '@/lib/admin-auth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import { FileText, Users, LogOut, LayoutDashboard, User, Tags, FolderOpen, Rss, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const menuItems: Array<{
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}> = [
    { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
    { title: 'Posts', url: '/admin/posts', icon: FileText },
    { title: 'Leitor de Feed', url: '/admin/feed', icon: Newspaper },
    { title: 'Fontes', url: '/admin/fontes', icon: Rss },
    { title: 'Categorias', url: '/admin/categorias', icon: FolderOpen },
    { title: 'Tags', url: '/admin/tags', icon: Tags },
    { title: 'Usuários', url: '/admin/usuarios', icon: Users, adminOnly: true },
  ];

export function AdminLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const authenticated = adminAuth.isAuthenticated();
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    adminAuth.logout();
    navigate('/admin/login');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  const user = adminAuth.getCurrentUser();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarContent>
            <div className="p-4 bg-slate-900 text-oceanic-foreground">
              <h1 className="text-2xl font-bold text-white text-center py-4">Scriby</h1>
            </div>

            <SidebarGroup>
              <SidebarGroupLabel className="font-noto-serif">Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems
                    .filter((item) => !item.adminOnly || user?.role === 'ADMIN')
                    .map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.url === '/admin'}
                            className={({ isActive }) =>
                              isActive
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                : 'hover:bg-sidebar-accent/50'
                            }
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="font-noto-serif text-[.9rem]">{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <div className="mt-auto px-2 py-4 border-t border-sidebar-border space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start hover:bg-oceanic hover:text-oceanic-foreground font-noto-serif text-[.9rem] p-2 mb-0 gap-0"
                onClick={() => navigate('/admin/perfil')}
              >
                <User className="h-4 w-4 mr-2" />
                Meu Perfil
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start hover:bg-oceanic hover:text-oceanic-foreground font-noto-serif text-[.9rem] p-2 mt-0 gap-0"
                onClick={handleLogout}
                style={{ marginTop: '0' }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Olá, {user?.name.split(' ')[0]}!</span>
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 p-6 bg-muted/30">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
