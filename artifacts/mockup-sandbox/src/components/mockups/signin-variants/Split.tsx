export function Split() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div
        className="relative overflow-hidden flex flex-col"
        style={{
          width: 390,
          height: 844,
          fontFamily: "'Poppins', sans-serif",
          background: "linear-gradient(160deg, #8B2FF5 0%, #2563EB 100%)",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        `}</style>

        {/* Top: Logo over gradient */}
        <div className="flex flex-col items-center pt-12 px-8 z-10">
          <img
            src="/__mockup/images/fitweek-logo.png"
            alt="FitWeek"
            style={{ width: 160, height: 50, objectFit: "contain", filter: "brightness(0) invert(1)" }}
          />
          <p style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.8)", marginTop: 6 }}>
            Your week, already dressed.
          </p>
        </div>

        {/* Hero image — floats in the gradient zone */}
        <div
          style={{
            flex: 1,
            position: "relative",
            marginTop: 16,
            marginLeft: 20,
            marginRight: 20,
            borderRadius: "20px 20px 0 0",
            overflow: "hidden",
          }}
        >
          <img
            src="/__mockup/images/fitweek-hero.png"
            alt="FitWeek app features"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
          />
          {/* subtle bottom fade so image blends into white sheet */}
          <div
            style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              height: 60,
              background: "linear-gradient(transparent, rgba(255,255,255,0.95))",
            }}
          />
        </div>

        {/* Bottom white sheet */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "24px 24px 0 0",
            paddingLeft: 28,
            paddingRight: 28,
            paddingTop: 24,
            paddingBottom: 40,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E4E0F5", alignSelf: "center", marginBottom: 4 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#1A1F36", textAlign: "center" }}>
              Plan once. Wear all week.
            </p>
            <p style={{ fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 1.5 }}>
              Smart wardrobe planning — weather-aware, laundry-aware.
            </p>
          </div>

          {/* Google CTA */}
          <button
            style={{
              height: 52,
              borderRadius: 12,
              background: "linear-gradient(135deg, #8B2FF5 0%, #2563EB 100%)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              cursor: "pointer",
              width: "100%",
              marginTop: 4,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white" opacity="0.9"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white" opacity="0.9"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white" opacity="0.9"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white" opacity="0.9"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>
              Continue with Google
            </span>
          </button>

          <p style={{ fontSize: 11, color: "#A0ABBB", textAlign: "center", lineHeight: 1.5 }}>
            By continuing you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
