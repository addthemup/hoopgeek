// UserSettings now redirects to UserDashboard
// This file is kept for backwards compatibility
import UserDashboard from './UserDashboard';

export default function UserSettings() {
  return <UserDashboard />;
}
