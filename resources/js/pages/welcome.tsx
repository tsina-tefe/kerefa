import AppLogoIcon from '@/components/app-logo-icon';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head />
            <div className="relative flex min-h-screen flex-col bg-white text-neutral-900">
                <header className="absolute inset-x-0 top-10 flex justify-start px-8 sm:top-12 sm:px-12">
                    {auth.user ? (
                        <Link
                            href={route('dashboard')}
                            className="rounded-full bg-[#f26b1d] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(242,107,29,0.28)] transition hover:bg-[#e05e12]"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <Link
                            href={route('login')}
                            className="rounded-full bg-[#f26b1d] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(242,107,29,0.28)] transition hover:bg-[#e05e12]"
                        >
                            Log in
                        </Link>
                    )}
                </header>

                <main className="flex flex-1 flex-col items-center justify-center px-6">
                    <div className="mb-6 flex size-28 items-center justify-center rounded-full bg-[#f26b1d] text-white shadow-[0_8px_24px_rgba(242,107,29,0.28)]">
                        <AppLogoIcon className="size-16 fill-current" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">QEREFA</h1>
                    <p className="mt-2 text-lg text-neutral-500" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
                        ቀረፋ
                    </p>
                </main>
            </div>
        </>
    );
}
