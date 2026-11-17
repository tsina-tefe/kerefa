import AppLogoIcon from './app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-[#f26b1d] text-white">
                <AppLogoIcon className="size-5 fill-current" />
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="mb-0 truncate leading-tight font-semibold">QEREFA</span>
                <span className="truncate text-[10px] leading-none text-neutral-500" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
                    ቀረፋ
                </span>
            </div>
        </>
    );
}
