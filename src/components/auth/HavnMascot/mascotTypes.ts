export type MascotFieldFocus = 'idle' | 'name' | 'email' | 'password' | 'confirmPassword' | 'submitting' | 'success';

export interface HavnMascotProps {
  focusedField?: MascotFieldFocus;
  isSubmitting?: boolean;
  hasError?: boolean;
  reduceMotion?: boolean;
  className?: string;
}
