import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("./MapPickerClient"), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});

export default MapPicker;
