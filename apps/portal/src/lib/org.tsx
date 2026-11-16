import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

interface OrgContextValue {
  organisations: Organisation[];
  currentOrgId: string | null;
  currentOrg: Organisation | null;
  loading: boolean;
  setCurrentOrgId: (id: string) => void;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);
const CURRENT_ORG_KEY = 'formcoach.currentOrgId';

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(localStorage.getItem(CURRENT_ORG_KEY));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrganisations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const orgs = await api.get<Organisation[]>('/v1/organisations');
    setOrganisations(orgs);
    if (orgs.length > 0 && !orgs.some((o) => o.id === currentOrgId)) {
      setCurrentOrgIdState(orgs[0].id);
      localStorage.setItem(CURRENT_ORG_KEY, orgs[0].id);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    localStorage.setItem(CURRENT_ORG_KEY, id);
  }, []);

  const currentOrg = organisations.find((o) => o.id === currentOrgId) ?? null;

  return (
    <OrgContext.Provider value={{ organisations, currentOrgId, currentOrg, loading, setCurrentOrgId, refresh }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
