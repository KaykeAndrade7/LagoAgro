import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  SVGProps,
} from 'react'

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Ícones — traço único consistente (stroke 2, round), nunca emoji/glifo Unicode.
// ---------------------------------------------------------------------------

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function IconPencil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-11 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Button — botão "carimbo": preenchido, borda grossa, sombra sólida deslocada
// que "afunda" ao pressionar. Ghost/outline para ações secundárias em linha.
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'danger-ghost'
type ButtonSize = 'default' | 'sm'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'border-ink bg-accent text-accent-contrast stamp-shadow hover:brightness-105',
  outline: 'border-ink bg-paper text-ink stamp-shadow-sm hover:bg-accent-soft',
  ghost: 'border-transparent bg-transparent text-ink-soft shadow-none hover:text-ink',
  danger: 'border-ink bg-danger text-paper stamp-shadow hover:brightness-105',
  'danger-ghost': 'border-transparent bg-transparent text-rust shadow-none hover:text-danger',
}

const buttonSizes: Record<ButtonSize, string> = {
  default: 'px-5 py-3 text-base',
  sm: 'px-3 py-2 text-sm',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'primary', size = 'default', className, ...props }: ButtonProps) {
  const isGhost = variant === 'ghost' || variant === 'danger-ghost'
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md border-2 font-display font-extrabold transition-[transform,box-shadow] duration-100',
        !isGhost && 'uppercase tracking-wide active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Field — label + input/select num único bloco, com erro inline.
// ---------------------------------------------------------------------------

const fieldControlClass =
  'block w-full rounded-md border-2 border-line bg-paper px-3 py-3 font-display text-base font-semibold text-ink outline-none placeholder:text-ink-soft/70 focus:border-accent disabled:opacity-50'

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>

export function FieldLabel({ className, ...props }: LabelProps) {
  return <label className={cx('mb-1.5 block text-sm font-bold text-ink-soft', className)} {...props} />
}

type FieldErrorProps = { children?: ReactNode }

export function FieldError({ children }: FieldErrorProps) {
  if (!children) return null
  return (
    <p role="alert" className="mt-1.5 text-sm font-bold text-rust">
      {children}
    </p>
  )
}

type FieldProps = {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {hint && !error && <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
      <FieldError>{error}</FieldError>
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return <input className={cx(fieldControlClass, className)} {...props} />
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, ...props }: SelectProps) {
  return <select className={cx(fieldControlClass, className)} {...props} />
}

// ---------------------------------------------------------------------------
// Card — folha de papel do talão.
// ---------------------------------------------------------------------------

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cx('rounded-lg border-2 border-line bg-paper stamp-shadow-sm', className)}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badge — selo de status. Semântica de cor fixa: âmbar = atenção/hoje,
// terracota = atrasado, verde = concluído, neutro = pendente sem urgência.
// ---------------------------------------------------------------------------

export type BadgeTone = 'neutral' | 'amber' | 'rust' | 'accent'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'border-line bg-bg text-ink-soft',
  amber: 'border-amber/40 bg-amber-bg text-amber',
  rust: 'border-rust/40 bg-rust-bg text-rust',
  accent: 'border-accent/30 bg-accent-soft text-accent',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wide',
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// PageHeader — título + ação primária, com régua pontilhada separando do
// conteúdo. Usado no topo de toda página de lista.
// ---------------------------------------------------------------------------

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 dashed-divider pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="font-display text-2xl font-black uppercase tracking-tight text-ink">{title}</h1>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estados de carregamento / erro / vazio.
// ---------------------------------------------------------------------------

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return <p className="py-8 text-center font-display font-bold text-ink-soft">{label}</p>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3 p-5">
      <p className="font-display font-bold text-rust">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Card>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center font-display font-semibold text-ink-soft">{children}</p>
}

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }

export function Checkbox({ id, label, className, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 font-display font-semibold text-ink">
      <input id={id} type="checkbox" className={cx('h-5 w-5 accent-accent', className)} {...props} />
      {label}
    </label>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-md border-2 border-rust/30 bg-rust-bg px-3 py-2 text-sm font-bold text-rust">
      {children}
    </p>
  )
}
