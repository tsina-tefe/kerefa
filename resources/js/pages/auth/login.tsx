import { Head, Link, useForm } from '@inertiajs/react';
import { Lock, User } from 'lucide-react';
import { FormEventHandler } from 'react';

import AppLogoIcon from '@/components/app-logo-icon';
import InputError from '@/components/input-error';

interface LoginForm {
    username: string;
    password: string;
    remember: boolean;
}

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        username: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-white px-4">
            <Head title="Log in" />

            <div className="mb-4 flex flex-col items-center">
                <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-[#f26b1d] text-white shadow-[0_1px_2px_rgba(242,107,29,0.35)]">
                    <AppLogoIcon className="size-9 fill-current" />
                </div>
                <h1 className="text-[28px] font-bold tracking-tight text-neutral-900">QEREFA</h1>
                <p className="mt-1 text-base text-neutral-500" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
                    ቀረፋ
                </p>
            </div>

            <div className="w-full max-w-[340px] border border-neutral-200 bg-white px-5 pt-5 pb-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                <p className="mb-4 text-center text-[13px] text-neutral-500">Login to start your session</p>

                <form className="flex flex-col gap-3" onSubmit={submit}>
                    <div>
                        <div className="relative">
                            <input
                                id="username"
                                type="text"
                                name="username"
                                required
                                autoFocus
                                autoComplete="username"
                                value={data.username}
                                onChange={(e) => setData('username', e.target.value)}
                                placeholder="Username"
                                className="h-10 w-full border border-[#d5e2ee] bg-[#eef5fb] pr-10 pl-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-[#f26b1d]"
                            />
                            <User className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#e07a2f]" />
                        </div>
                        <InputError message={errors.username} className="mt-1" />
                    </div>

                    <div>
                        <div className="relative">
                            <input
                                id="password"
                                type="password"
                                name="password"
                                required
                                autoComplete="current-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="Password"
                                className="h-10 w-full border border-[#d5e2ee] bg-[#eef5fb] pr-10 pl-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-[#f26b1d]"
                            />
                            <Lock className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#e07a2f]" />
                        </div>
                        <InputError message={errors.password} className="mt-1" />
                    </div>

                    <div className="mt-1 flex items-center justify-between">
                        <label htmlFor="remember" className="flex items-center gap-2 text-[13px] text-neutral-700">
                            <input
                                id="remember"
                                type="checkbox"
                                name="remember"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="size-3.5 accent-[#f26b1d]"
                            />
                            Remember Me
                        </label>

                        {canResetPassword && (
                            <Link href={route('password.request')} className="text-[13px] text-[#f26b1d] hover:underline">
                                Forgot Password?
                            </Link>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        className="mt-1 h-9 w-full bg-[#f26b1d] text-sm font-medium text-white hover:bg-[#e05e12] disabled:opacity-70"
                    >
                        Login
                    </button>

                    {status && <p className="text-center text-sm text-green-600">{status}</p>}
                </form>
            </div>
        </div>
    );
}
