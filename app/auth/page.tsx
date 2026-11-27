import { redirect } from 'next/navigation';

/** The old vendor landing page (still branded with the previous name). Everyone signs in from one place now. */
export default function AuthIndex() {
  redirect('/auth/signin');
}
