import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Status } from '@/pages/Status';
import { Oracle } from '@/pages/Oracle';
import { Archive } from '@/pages/Archive';
import { Registry } from '@/pages/Registry';
import { System } from '@/pages/System';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/status" replace />} />
        <Route path="/status" element={<Status />} />
        <Route path="/oracle" element={<Oracle />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/registry" element={<Registry />} />
        <Route path="/system" element={<System />} />
        <Route path="*" element={<Navigate to="/status" replace />} />
      </Route>
    </Routes>
  );
}
