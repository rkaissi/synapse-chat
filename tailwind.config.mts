import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./lib/**/*.{js,ts,jsx,tsx,mdx}"
    ],
    theme: {
        extend: {
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic":
                    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))"
            },
            typography: {
                DEFAULT: {
                    css: {
                        pre: false
                    }
                }
            }
        },
        colors: {
            transparent: "transparent",

            black: "#000",
            white: "#fff",

            grey: {
                100: "#f7fafc",
                200: "#edf2f7",
                300: "#e2e8f0",
                400: "#cbd5e0",
                500: "#a0aec0",
                600: "#718096",
                700: "#4a5568",
                800: "#2d3748",
                900: "#1a202c"
            },
            gray: {
                100: "#f7fafc",
                200: "#edf2f7",
                300: "#e2e8f0",
                400: "#cbd5e0",
                500: "#a0aec0",
                600: "#718096",
                700: "#4a5568",
                800: "#2d3748",
                900: "#1a202c"
            },
            red: {
                100: "#fff5f5",
                200: "#fed7d7",
                300: "#feb2b2",
                400: "#fc8181",
                500: "#f56565",
                600: "#e53e3e",
                700: "#c53030",
                800: "#9b2c2c",
                900: "#742a2a"
            },
            orange: {
                100: "#fffaf0",
                200: "#feebc8",
                300: "#fbd38d",
                400: "#f6ad55",
                500: "#ed8936",
                600: "#dd6b20",
                700: "#c05621",
                800: "#9c4221",
                900: "#7b341e"
            },
            amber: {
                50: "#fffbeb",
                100: "#fef3c7",
                200: "#fde68a",
                300: "#fcd34d",
                400: "#fbbf24",
                500: "#f59e0b",
                600: "#d97706",
                700: "#b45309",
                800: "#92400e",
                900: "#78350f"
            },
            yellow: {
                100: "#fffff0",
                200: "#fefcbf",
                300: "#faf089",
                400: "#f6e05e",
                500: "#ecc94b",
                600: "#d69e2e",
                700: "#b7791f",
                800: "#975a16",
                900: "#744210"
            },
            lime: {
                50: "#f7fee7",
                100: "#ecfccb",
                200: "#d9f99d",
                300: "#bef264",
                400: "#a3e635",
                500: "#84cc16",
                600: "#65a30d",
                700: "#4d7c0f",
                800: "#3f6212",
                900: "#365314"
            },
            green: {
                100: "#f0fff4",
                200: "#c6f6d5",
                300: "#9ae6b4",
                400: "#68d391",
                500: "#48bb78",
                600: "#38a169",
                700: "#2f855a",
                800: "#276749",
                900: "#22543d"
            },
            emerald: {
                50: "#ecfdf5",
                100: "#d1fae5",
                200: "#a7f3d0",
                300: "#6ee7b7",
                400: "#34d399",
                500: "#10b981",
                600: "#059669",
                700: "#047857",
                800: "#065f46",
                900: "#064e3b"
            },
            teal: {
                100: "#e6fffa",
                200: "#b2f5ea",
                300: "#81e6d9",
                400: "#4fd1c5",
                500: "#38b2ac",
                600: "#319795",
                700: "#2c7a7b",
                800: "#285e61",
                900: "#234e52"
            },
            cyan: {
                50: "#ecfeff",
                100: "#cffafe",
                200: "#a5f3fc",
                300: "#67e8f9",
                400: "#22d3ee",
                500: "#06b6d4",
                600: "#0891b2",
                700: "#0e7490",
                800: "#155e75",
                900: "#164e63"
            },
            sky: {
                50: "#f0f9ff",
                100: "#e0f2fe",
                200: "#bae6fd",
                300: "#7dd3fc",
                400: "#38bdf8",
                500: "#0ea5e9",
                600: "#0284c7",
                700: "#0369a1",
                800: "#075985",
                900: "#0c4a6e"
            },
            blue: {
                100: "#ebf8ff",
                200: "#bee3f8",
                300: "#90cdf4",
                400: "#63b3ed",
                500: "#4299e1",
                600: "#3182ce",
                700: "#2b6cb0",
                800: "#2c5282",
                900: "#2a4365"
            },
            indigo: {
                100: "#ebf4ff",
                200: "#c3dafe",
                300: "#a3bffa",
                400: "#7f9cf5",
                500: "#667eea",
                600: "#5a67d8",
                700: "#4c51bf",
                800: "#434190",
                900: "#3c366b"
            },
            violet: {
                50: "#f5f3ff",
                100: "#ede9fe",
                200: "#ddd6fe",
                300: "#c4b5fd",
                400: "#a78bfa",
                500: "#8b5cf6",
                600: "#7c3aed",
                700: "#6d28d9",
                800: "#5b21b6",
                900: "#4c1d95"
            },
            purple: {
                100: "#faf5ff",
                200: "#e9d8fd",
                300: "#d6bcfa",
                400: "#b794f4",
                500: "#9f7aea",
                600: "#805ad5",
                700: "#6b46c1",
                800: "#553c9a",
                900: "#44337a"
            },
            fuchsia: {
                50: "#fdf4ff",
                100: "#fae8ff",
                200: "#f5d0fe",
                300: "#f0abfc",
                400: "#e879f9",
                500: "#d946ef",
                600: "#c026d3",
                700: "#a21caf",
                800: "#86198f",
                900: "#701a75"
            },
            pink: {
                100: "#fff5f7",
                200: "#fed7e2",
                300: "#fbb6ce",
                400: "#f687b3",
                500: "#ed64a6",
                600: "#d53f8c",
                700: "#b83280",
                800: "#97266d",
                900: "#702459"
            },
            rose: {
                50: "#fff1f2",
                100: "#ffe4e6",
                200: "#fecdd3",
                300: "#fda4af",
                400: "#fb7185",
                500: "#f43f5e",
                600: "#e11d48",
                700: "#be123c",
                800: "#9f1239",
                900: "#881337"
            },
            border: "hsl(var(--border))",
            input: "hsl(var(--input))",
            ring: "hsl(var(--ring))",
            background: "hsl(var(--background))",
            foreground: "hsl(var(--foreground))",
            primary: {
                DEFAULT: "hsl(var(--primary))",
                foreground: "hsl(var(--primary-foreground))"
            },
            secondary: {
                DEFAULT: "hsl(var(--secondary))",
                foreground: "hsl(var(--secondary-foreground))"
            },
            destructive: {
                DEFAULT: "hsl(var(--destructive))",
                foreground: "hsl(var(--destructive-foreground))"
            },
            muted: {
                DEFAULT: "hsl(var(--muted))",
                foreground: "hsl(var(--muted-foreground))"
            },
            accent: {
                DEFAULT: "hsl(var(--accent))",
                foreground: "hsl(var(--accent-foreground))"
            },
            popover: {
                DEFAULT: "hsl(var(--popover))",
                foreground: "hsl(var(--popover-foreground))"
            },
            card: {
                DEFAULT: "hsl(var(--card))",
                foreground: "hsl(var(--card-foreground))"
            }
        },
        borderRadius: {
            full: "9999px",
            xl: "0.75rem",
            "2xl": "1rem",
            lg: "var(--radius)",
            md: "calc(var(--radius) - 2px)",
            sm: "calc(var(--radius) - 4px)"
        },
        keyframes: {
            "accordion-down": {
                from: {
                    height: "0"
                },
                to: {
                    height: "var(--radix-accordion-content-height)"
                }
            },
            "accordion-up": {
                from: {
                    height: "var(--radix-accordion-content-height)"
                },
                to: {
                    height: "0"
                }
            }
        },
        animation: {
            "accordion-down": "accordion-down 0.2s ease-out",
            "accordion-up": "accordion-up 0.2s ease-out"
        }
    },
    plugins: [typography]
};
export default config;
