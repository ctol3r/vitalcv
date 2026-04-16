/**
 * @deprecated — migrating to canonical Card at '@/components/ui/card'.
 * This re-export shim preserves API compatibility during migration.
 */

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

export type CardProps = React.ComponentProps<'div'>;
