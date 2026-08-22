import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/server/permissions';

/** Shortcut so a coworker's nav can point at "my profile" without knowing its id. */
export default async function MyProfilePage() {
  const user = await requireUser('/coworkers/me');
  if (!user.coworkerId) redirect('/dashboard');
  redirect(`/coworkers/${user.coworkerId}`);
}
