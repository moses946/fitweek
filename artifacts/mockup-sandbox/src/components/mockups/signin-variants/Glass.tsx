export function Glass() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div
        className="relative overflow-hidden flex flex-col"
        style={{
          width: 390,
          height: 844,
          fontFamily: "'Poppins', sans-serif",
          background: "linear-gradient(145deg, #8B2FF5 0%, #5B4FE8 45%, #2563EB 100%)",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        `}</style>

        {/* Ambient orbs */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 280, height: 280, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: 120, left: -60,
          width: 220, height: 220, borderRadius: "50%",
          background: "rgba(37,99,235,0.25)",
          filter: "blur(50px)",
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-6 pt-12 pb-10" style={{ gap: 18 }}>

          {/* Logo */}
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <img
              src="/__mockup/images/fitweek-logo.png"
              alt="FitWeek"
              style={{ width: 160, height: 50, objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
          </div>

          {/* Hero card — glassmorphism */}
          <div
            style={{
              flex: 1,
              borderRadius: 24,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.28)",
              background: "rgba(255,255,255,0.10)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              position: "relative",
              boxShadow: "0 8px 40px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <img
              src="/__mockup/images/fitweek-hero.png"
              alt="FitWeek app features"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Inner top fade */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 48,
              background: "linear-gradient(rgba(139,47,245,0.45), transparent)",
            }} />
            {/* Inner bottom fade */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 56,
              background: "linear-gradient(transparent, rgba(37,99,235,0.50))",
            }} />
          </div>

          {/* Tagline */}
          <p style={{
            fontSize: 18,
            fontWeight: 500,
            color: "#FFFFFF",
            textAlign: "center",
            letterSpacing: 0.1,
            opacity: 0.95,
          }}>
            Your week, already dressed.
          </p>

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
              boxShadow: "0 4px 24px rgba(0,0,0,0.20)",
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

          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", textAlign: "center", lineHeight: 1.5 }}>
            By continuing you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
