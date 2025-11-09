import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

let access_token = "";
let refresh_token = "";

// ✅ Root route just to test deployment
app.get("/", (req, res) => {
  res.json({ message: "🎵 Spotify API is active" });
});

// ✅ Login route (for manual authorization)
app.get("/login", (req, res) => {
  const scope = [
    "user-read-currently-playing",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-top-read",
    "user-follow-read",
  ].join(" ");

  const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
  const url =
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: redirect_uri,
    }).toString();

  res.redirect(url);
});

// ✅ Spotify callback for tokens
app.get("/callback", async (req, res) => {
  const code = req.query.code || null;
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      })
    );

    access_token = response.data.access_token;
    refresh_token = response.data.refresh_token;

    res.send("✅ Spotify Auth Successful! Visit /spotify to see data.");
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Spotify auth failed" });
  }
});

// ✅ Core route your portfolio fetches
app.get("/spotify", async (req, res) => {
  try {
    const [tracks, nowPlaying, artists] = await Promise.all([
      axios.get("https://api.spotify.com/v1/me/top/tracks?limit=10", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      axios.get("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      axios.get("https://api.spotify.com/v1/me/following?type=artist", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    ]);

    res.json({
      topTracks: tracks.data.items.map((t) => ({
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        uri: t.uri,
      })),
      nowPlaying: nowPlaying.data
        ? {
            name: nowPlaying.data.item.name,
            artist: nowPlaying.data.item.artists
              .map((a) => a.name)
              .join(", "),
          }
        : "Nothing playing",
      followedArtists: artists.data.artists.items.map((a) => a.name),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      error:
        "Spotify data fetch failed — you may need to re-authenticate at /login",
    });
  }
});

app.listen(process.env.PORT || 8888, () =>
  console.log(`🚀 Server running on ${process.env.PORT || 8888}`)
);