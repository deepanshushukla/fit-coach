import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordRecovery';
import { AcceptInvitePage } from './pages/AcceptInvite';
import { OrgSetupPage } from './pages/OrgSetup';
import { OrgOverviewPage } from './pages/OrgOverview';
import { MembersPage } from './pages/Members';
import { ApplicationsPage } from './pages/Applications';
import { ApplicationDetailPage } from './pages/ApplicationDetail';
import { LicencesPage } from './pages/Licences';
import { LicenceDetailPage } from './pages/LicenceDetail';
import { PlansPage } from './pages/Plans';
import { ExercisesPage, ExerciseDetailPage } from './pages/Exercises';
import { UsagePage } from './pages/Usage';
import { AuditLogPage } from './pages/AuditLog';
import { DocsPage } from './pages/Docs';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route
          path="/org-setup"
          element={
            <ProtectedRoute>
              <OrgSetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/org" replace />} />
          <Route path="org" element={<OrgOverviewPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/:applicationId" element={<ApplicationDetailPage />} />
          <Route path="licences" element={<LicencesPage />} />
          <Route path="licences/:licenceId" element={<LicenceDetailPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="exercises/:exerciseId" element={<ExerciseDetailPage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="audit-log" element={<AuditLogPage />} />
          <Route path="docs" element={<DocsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
