import DevicesIcon from "@mui/icons-material/Devices";
import HomeIcon from "@mui/icons-material/Home";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SpaIcon from "@mui/icons-material/Spa";
import ToysIcon from "@mui/icons-material/Toys";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import PetsIcon from "@mui/icons-material/Pets";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import YardIcon from "@mui/icons-material/Yard";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import DiamondIcon from "@mui/icons-material/Diamond";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import BuildIcon from "@mui/icons-material/Build";
import LuggageIcon from "@mui/icons-material/Luggage";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import CleanHandsIcon from "@mui/icons-material/CleanHands";
import KitchenIcon from "@mui/icons-material/Kitchen";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
const EcoIcon = YardIcon;

export const MARQUEE_MESSAGES = [
  "24/7 Delivery",
  "Minimum Order ₹99",
  "Save Big on Essentials!",
];

export const ICON_COMPONENTS = {
  electronics: DevicesIcon,
  fashion: CheckroomIcon,
  home: HomeIcon,
  food: LocalCafeIcon,
  sports: SportsSoccerIcon,
  books: MenuBookIcon,
  beauty: SpaIcon,
  body: SpaIcon,
  hair: ContentCutIcon,
  skincare: AutoAwesomeIcon,
  sunscreen: WbSunnyIcon,
  toys: ToysIcon,
  automotive: DirectionsCarIcon,
  pets: PetsIcon,
  health: LocalHospitalIcon,
  garden: YardIcon,
  office: BusinessCenterIcon,
  music: MusicNoteIcon,
  jewelry: DiamondIcon,
  baby: ChildCareIcon,
  tools: BuildIcon,
  luggage: LuggageIcon,
  art: ColorLensIcon,
  grocery: LocalGroceryStoreIcon,
};

export const CATEGORY_NAME_ICON_MAP = {
  all: HomeIcon,
  body: SpaIcon,
  "body care": SpaIcon,
  bodycare: SpaIcon,
  hair: ContentCutIcon,
  "hair care": ContentCutIcon,
  haircare: ContentCutIcon,
  skincare: AutoAwesomeIcon,
  "skin care": AutoAwesomeIcon,
  skin: AutoAwesomeIcon,
  sunscreen: WbSunnyIcon,
  sun: WbSunnyIcon,
  beauty: SpaIcon,
  "personal care": CleanHandsIcon,
  grocery: LocalGroceryStoreIcon,
  groceries: LocalGroceryStoreIcon,
  food: LocalCafeIcon,
  "food and meal": LocalCafeIcon,
  meal: LocalCafeIcon,
  home: HomeIcon,
  "home & kitchen": KitchenIcon,
  kitchen: KitchenIcon,
  electronics: DevicesIcon,
  kids: ChildCareIcon,
  baby: ChildCareIcon,
  pets: PetsIcon,
  "pet supplies": PetsIcon,
  sports: SportsSoccerIcon,
  wedding: CardGiftcardIcon,
  gift: CardGiftcardIcon,
  test: EcoIcon,
};

export function resolveCategoryIcon(name, iconId, fallback = null) {
  if (iconId && ICON_COMPONENTS[iconId]) {
    return ICON_COMPONENTS[iconId];
  }
  const cleanName = String(name || "").toLowerCase().trim();
  if (cleanName && CATEGORY_NAME_ICON_MAP[cleanName]) {
    return CATEGORY_NAME_ICON_MAP[cleanName];
  }
  if (cleanName.includes("body")) return SpaIcon;
  if (cleanName.includes("hair")) return ContentCutIcon;
  if (cleanName.includes("skin") || cleanName.includes("face")) return AutoAwesomeIcon;
  if (cleanName.includes("sun") || cleanName.includes("screen")) return WbSunnyIcon;
  if (cleanName.includes("beauty")) return SpaIcon;
  if (cleanName.includes("groc")) return LocalGroceryStoreIcon;
  if (cleanName.includes("food") || cleanName.includes("meal") || cleanName.includes("cafe")) return LocalCafeIcon;
  if (cleanName.includes("home") || cleanName.includes("kitchen")) return KitchenIcon;
  if (cleanName.includes("kid") || cleanName.includes("baby")) return ChildCareIcon;
  if (cleanName.includes("pet")) return PetsIcon;
  if (cleanName.includes("sport")) return SportsSoccerIcon;
  if (cleanName.includes("wed") || cleanName.includes("gift")) return CardGiftcardIcon;
  if (cleanName.includes("test")) return EcoIcon;

  return fallback;
}

export const QUICK_CATEGORY_PALETTES = [
  {
    bgFrom: "#ffd96a",
    bgVia: "#ffeaa0",
    bgTo: "#fff0c7",
    glowColor: "rgba(255,184,0,0.18)",
    frameColor: "#f0d98a",
  },
  {
    bgFrom: "var(--primary)",
    bgVia: "#cffafe",
    bgTo: "#ecfeff",
    glowColor: "rgba(97,218,251,0.18)",
    frameColor: "#a5f3fc",
  },
  {
    bgFrom: "#f3a25d",
    bgVia: "#f9c48b",
    bgTo: "#fee0bf",
    frameColor: "#efc08e",
  },
  {
    bgFrom: "#b8eff0",
    bgVia: "#d5f7f5",
    bgTo: "#edfdfc",
    glowColor: "rgba(122,215,215,0.16)",
    frameColor: "#b9e5e3",
  },
];

export function getCategoryFallbackImage(name) {
  const cleanName = String(name || "").toLowerCase().trim();
  if (cleanName.includes("body lotion")) {
    return "/assets/category-icons/body_lotion.png";
  }
  if (cleanName.includes("soap") || cleanName.includes("bath soap")) {
    return "/assets/category-icons/soap.png";
  }
  if (cleanName.includes("hair oil") || cleanName.includes("hair")) {
    return "/assets/category-icons/hair_oil.png";
  }
  if (cleanName.includes("cream") || cleanName.includes("moisturizer")) {
    return "/assets/category-icons/cream.png";
  }
  if (cleanName.includes("face wash") || cleanName.includes("facewash") || cleanName.includes("cleanser") || cleanName.includes("face")) {
    return "/assets/category-icons/face_wash.png";
  }
  if (cleanName.includes("aata") || cleanName.includes("dal") || cleanName.includes("rice") || cleanName.includes("grain")) {
    return "/assets/category-icons/aata_dal_rice.png";
  }
  if (cleanName.includes("dairy") || cleanName.includes("bread") || cleanName.includes("milk") || cleanName.includes("butter")) {
    return "/assets/category-icons/dairy_breads.png";
  }
  if (cleanName.includes("fruit") || cleanName.includes("veg") || cleanName.includes("vegetable")) {
    return "/assets/category-icons/fruits_vegetables.png";
  }
  if (cleanName.includes("masala") || cleanName.includes("spice")) {
    return "/assets/category-icons/masala_spices.png";
  }
  if (cleanName.includes("wipe") || cleanName.includes("tissue") || cleanName.includes("dry essential")) {
    return "https://cdn-icons-png.flaticon.com/512/3050/3050239.png";
  }
  if (cleanName.includes("kids food") || cleanName.includes("baby food")) {
    return "https://cdn-icons-png.flaticon.com/512/3050/3050174.png";
  }
  if (cleanName.includes("kids essential") || cleanName.includes("baby care") || cleanName.includes("diaper")) {
    return "https://cdn-icons-png.flaticon.com/512/3050/3050186.png";
  }
  if (cleanName.includes("toy") || cleanName.includes("game")) {
    return "https://cdn-icons-png.flaticon.com/512/3082/3082060.png";
  }
  if (cleanName.includes("cat food") || cleanName.includes("cat")) {
    return "https://cdn-icons-png.flaticon.com/512/3048/3048386.png";
  }
  if (cleanName.includes("dog food") || cleanName.includes("dog")) {
    return "https://cdn-icons-png.flaticon.com/512/3048/3048396.png";
  }
  if (cleanName.includes("pet grooming") || cleanName.includes("grooming")) {
    return "https://cdn-icons-png.flaticon.com/512/3048/3048408.png";
  }
  if (cleanName.includes("pet toy") || cleanName.includes("pet")) {
    return "https://cdn-icons-png.flaticon.com/512/3048/3048420.png";
  }
  if (cleanName.includes("basketball")) {
    return "https://cdn-icons-png.flaticon.com/512/3079/3079144.png";
  }
  if (cleanName.includes("cricket")) {
    return "https://cdn-icons-png.flaticon.com/512/3079/3079162.png";
  }
  if (cleanName.includes("fitness") || cleanName.includes("gym") || cleanName.includes("weight")) {
    return "https://cdn-icons-png.flaticon.com/512/3079/3079133.png";
  }
  if (cleanName.includes("swim") || cleanName.includes("pool")) {
    return "https://cdn-icons-png.flaticon.com/512/3079/3079155.png";
  }
  if (cleanName.includes("clean") || cleanName.includes("gadget")) {
    return "https://cdn-icons-png.flaticon.com/512/2954/2954893.png";
  }
  if (cleanName.includes("cookware") || cleanName.includes("pan") || cleanName.includes("pot") || cleanName.includes("kitchen")) {
    return "https://cdn-icons-png.flaticon.com/512/3081/3081840.png";
  }
  if (cleanName.includes("iron") || cleanName.includes("appliance")) {
    return "https://cdn-icons-png.flaticon.com/512/3050/3050158.png";
  }
  if (cleanName.includes("body")) {
    return "/assets/category-icons/body_lotion.png";
  }
  return "https://cdn-icons-png.flaticon.com/512/3081/3081967.png";
}


