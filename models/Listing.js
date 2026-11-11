import mongoose from "mongoose";

/**
 * One item stack offered on the market. Listings expire after three days so a
 * forgotten auction cannot sit in the board forever.
 */
const listingSchema = new mongoose.Schema({
  sellerId: { type: String, required: true, index: true },
  sellerName: { type: String, required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  itemKey: { type: String, required: true, index: true },
  quantity: { type: Number, default: 1, min: 1 },
  price: { type: Number, required: true, min: 1 },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 3 },
});

listingSchema.index({ price: 1 });

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
