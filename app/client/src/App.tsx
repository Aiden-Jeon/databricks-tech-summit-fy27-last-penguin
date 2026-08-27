import { SessionProvider } from '@/lib/api';
import { GrowthDesk } from '@/growth/GrowthDesk';

export default function App() {
  return (
    <SessionProvider>
      <GrowthDesk />
    </SessionProvider>
  );
}
