import { Navigate } from 'react-router-dom';
import { adminAuth } from '@/lib/admin-auth';

interface AdminOnlyRouteProps {
    children: React.ReactNode;
}

/**
 * Componente de proteção de rota para rotas exclusivas de admin
 * Redireciona para o dashboard se o usuário não for admin
 */
export function AdminOnlyRoute({ children }: AdminOnlyRouteProps) {
    const user = adminAuth.getCurrentUser();

    if (!user || user.role !== 'ADMIN') {
        return <Navigate to="/admin" replace />;
    }

    return <>{children}</>;
}
