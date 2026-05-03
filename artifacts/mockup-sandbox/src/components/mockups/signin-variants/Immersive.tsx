export function Immersive() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div
        className="relative overflow-hidden flex flex-col"
        style={{
          width: 390,
          height: 844,
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
          .signin-immersive * { font-family: 'Poppins', sans-serif; }
        `}</style>

        {/* Full-bleed hero image */}
        <img
          src="/__mockup/images/fitweek-hero.png"
          alt="FitWeek hero"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Top gradient overlay — darkens top for logo legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(80,20,180,0.82) 0%, rgba(20,60,180,0.30) 40%, rgba(0,0,0,0.0) 60%, rgba(0,0,0,0.72) 100%)",
          }}
        />

        {/* Content layer */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Top — Logo */}
          <div className="flex flex-col items-center pt-14 px-8">
            <img
              src="/__mockup/images/fitweek-logo.png"
              alt="FitWeek"
              style={{ width: 180, height: 56, objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom — Tagline + CTA */}
          <div className="px-7 pb-12 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  lineHeight: 1.15,
                  letterSpacing: -0.3,
                }}
              >
                Your week,<br />already dressed.
              </p>
              <p style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
                Plan once. Look great all week.
              </p>
            </div>

            {/* Google CTA */}
            <button
              style={{
                height: 52,
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                cursor: "pointer",
                width: "100%",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1F36" }}>
                Continue with Google
              </span>
            </button>

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.5 }}>
              By continuing you agree to our Terms & Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
