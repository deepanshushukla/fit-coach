import { Route, Routes } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import { HomePage } from './pages/Home';
import { ApiReferencePage } from './pages/ApiReference';
import { SdkReferencePage } from './pages/SdkReference';
import { PricingPage } from './pages/Pricing';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<TopNav />}>
        <Route index element={<HomePage />} />
        <Route path="api" element={<ApiReferencePage />} />
        <Route path="sdk" element={<SdkReferencePage />} />
        <Route path="pricing" element={<PricingPage />} />
      </Route>
    </Routes>
  );
}
