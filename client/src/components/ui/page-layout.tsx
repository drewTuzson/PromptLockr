import { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
  backButton?: ReactNode;
}

export function PageLayout({ title, description, controls, children, backButton }: PageLayoutProps) {
  return (
    <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Content Header - Consistent with dashboard */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          {backButton}
          <div>
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        {controls && (
          <div className="flex items-center space-x-3">
            {controls}
          </div>
        )}
      </div>
      
      {/* Page Content */}
      {children}
    </main>
  );
}