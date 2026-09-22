import { Compass } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import { type LoginInput, useLogin } from "../../api/auth";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { cardClass, inputClass, labelClass } from "../../lib/formStyles";

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>();

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => navigate(redirectTo, { replace: true }),
    });
  });

  return (
    <div className="animate-fade-in-up mx-auto max-w-sm py-8">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
          <Compass className="h-6 w-6 text-white" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Log in to manage the dock schedule</p>
        </div>
      </div>
      <form onSubmit={onSubmit} className={`${cardClass} space-y-4 p-6`} noValidate>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            className={`${inputClass} w-full`}
            {...register("email", { required: "Email is required" })}
          />
          {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={`${inputClass} w-full`}
            {...register("password", { required: "Password is required" })}
          />
          {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
        </div>
        {login.isError && <ErrorState error={login.error} />}
        <Button type="submit" variant="primary" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}
