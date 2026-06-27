jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import storage from "@/lib/storage";

storage.setAdapter(storage.createInMemoryStorageAdapter());
