export enum Color {
    LightGreen = 0,
    Red = 1,
    LightBlue = 2,
    Violet = 3,
    Yellow = 4,
    Orange = 5,
    DarkGreen = 6,
    DarkBlue = 7,
    Cyan = 8,
    Purple = 9, // This is a magenta-like purple
    PastelPink = 10, // This is a magenta-like purple
    MossGreen = 11,
    Burgundy = 12,
    DarkViolet = 13,
    LandRed = 14,
    GreyBlue = 15,
    PastelViolet = 16, // This is a magenta-like purple
    Pink = 17,
    // Blue = 6,
    // Indigo = 5,
    // Brown = 8,
    // DarkMarine = 13,
    // GreyCyan = 19,
    Unk = -1,
    Hidden = 99,
}

export const COLOR_HEX_MAP: Record<string, string> = {
    [Color.LightGreen]: '#89B53A',
    [Color.Red]: '#D3362D',
    [Color.LightBlue]: '#35A3D8',
    [Color.Violet]: '#9F44D3',
    [Color.Yellow]: '#EAC22D',
    [Color.Orange]: '#F07F2D',
    [Color.DarkGreen]: '#008233',
    [Color.DarkBlue]: '#0050D3',
    [Color.Cyan]: '#00A398',
    [Color.Purple]: '#D33ED3',
    [Color.PastelPink]: '#eb8babff',
    [Color.MossGreen]: '#89A32D',
    [Color.Burgundy]: '#A32D50',
    [Color.DarkViolet]: '#502DA3',
    [Color.LandRed]: '#A33F2D',
    [Color.GreyBlue]: '#9FA3B5',
    [Color.PastelViolet]: '#C3B1E1',
    [Color.Pink]: '#D33E7F',
    [Color.Unk]: '#6B7280',
    [Color.Hidden]: '#303030',
};

export const PetColor: Color[] = [
    Color.LightGreen, Color.Red, Color.LightBlue, Color.Violet, Color.Yellow, Color.Orange, Color.DarkGreen,
    Color.DarkBlue, Color.Cyan, Color.Purple, Color.PastelPink, Color.MossGreen, Color.Burgundy,
    Color.DarkViolet, Color.LandRed, Color.GreyBlue, Color.PastelViolet,
    Color.Pink,
];

// Predefined list of colors for pet layers
export const LayerColors: Color[] = [
    Color.Cyan, Color.Yellow, Color.Pink, Color.Purple, Color.Orange,
];

export const NUMBER_TEXT_COLORS: string[] = [
    'text-lime-400',   // LightGreen
    'text-red-500',    // Red
    'text-sky-400',    // LightBlue
    'text-violet-500', // Violet
    'text-yellow-400', // Yellow
    'text-orange-500', // Orange
    'text-green-600',  // DarkGreen
    'text-blue-600',   // DarkBlue
    'text-cyan-400',   // Cyan
    'text-fuchsia-500',// Purple
    'text-blue-800',   // DarkMarine
    'text-lime-600',   // MossGreen
    'text-rose-700',   // Burgundy
    'text-indigo-600', // DarkViolet
    'text-red-700',    // LandRed
    'text-slate-400',  // GreyBlue
    'text-teal-600',   // GreyCyan
    'text-pink-500',   // Pink
];

export const getColorClassForNumber = (num: number): string => {
    if (num <= 0) return 'text-gray-200';
    // Use num directly to make the color consistent for the same number
    return NUMBER_TEXT_COLORS[(num - 1) % NUMBER_TEXT_COLORS.length];
};


// Color manipulation helpers
export const hexToRgba = (hex: string, alpha: number = 1): string => {
    if (!hex || hex.length < 7) return `rgba(128, 128, 128, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const darkenColor = (hex: string, percent: number): string => {
    if (!hex || hex.length < 7) return '#808080';
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    const amount = Math.floor(255 * (percent / 100));

    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);

    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};