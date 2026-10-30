/** @type {import('next').NextConfig} */
const nextConfig = {
  // The board ID is not a secret; expose it so the footer can link to the board.
  env: { NEXT_PUBLIC_TRELLO_BOARD_ID: process.env.TRELLO_BOARD_ID ?? "" },
};
export default nextConfig;
