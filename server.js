const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;

const DATA_URL =
  "https://raw.githubusercontent.com/alberttartas/Pirataflix/main/web/data.json";

let database = null;

async function loadData() {
  try {
    const { data } = await axios.get(DATA_URL, {
      timeout: 15000
    });

    database = data;

    console.log("Data loaded");
  } catch (err) {
    console.error(err.message);
  }
}

loadData();

setInterval(loadData, 300000);

function auth(req) {
  const { username, password } = req.query;

  return username && password;
}

app.get("/", (req, res) => {
  res.json({
    name: "Pirataflix Xtream API",
    status: "online"
  });
});

app.get("/player_api.php", async (req, res) => {
  if (!auth(req)) {
    return res.json({
      user_info: {
        auth: 0
      }
    });
  }

  const action = req.query.action;

  const movies = database?.movies || [];
  const series = database?.series || [];

  switch (action) {
    case "get_vod_categories":
      return res.json([
        {
          category_id: "1",
          category_name: "Filmes",
          parent_id: 0
        }
      ]);

    case "get_series_categories":
      return res.json([
        {
          category_id: "2",
          category_name: "Séries",
          parent_id: 0
        }
      ]);

    case "get_live_categories":
      return res.json([]);

    case "get_vod_streams":
      return res.json(
        movies.map((movie, index) => ({
          stream_id: index + 1,
          name: movie.title,
          category_id: "1",
          stream_icon: movie.poster,
          rating: movie.rating || 0,
          added: Date.now(),
          container_extension: "mp4"
        }))
      );

    case "get_series":
      return res.json(
        series.map((show, index) => ({
          series_id: index + 1,
          name: show.title,
          cover: show.poster,
          plot: show.overview || "",
          category_id: "2",
          rating: show.rating || 0
        }))
      );

    case "get_series_info": {
      const id = Number(req.query.series_id);

      const show = series[id - 1];

      if (!show) {
        return res.json({});
      }

      const episodes = {};

      (show.seasons || []).forEach((seasonObj) => {
        episodes[seasonObj.season] = seasonObj.episodes.map((ep) => ({
          id: ep.episode,
          episode_num: ep.episode,
          title: ep.title,
          container_extension: "mp4",
          info: {},
          custom_sid: "",
          added: Date.now()
        }));
      });

      return res.json({
        info: {
          name: show.title,
          cover: show.poster,
          plot: show.overview || ""
        },
        episodes
      });
    }

    default:
      return res.json({
        user_info: {
          auth: 1,
          status: "Active"
        },
        server_info: {
          url: req.hostname,
          port: PORT
        }
      });
  }
});

app.get("/movie/:user/:pass/:id.mp4", (req, res) => {
  const id = Number(req.params.id);

  const movie = database?.movies?.[id - 1];

  if (!movie) {
    return res.status(404).send("Not found");
  }

  const url = movie.episodes?.[0]?.url;

  return res.redirect(url);
});

app.get("/series/:user/:pass/:sid/:eid.mp4", (req, res) => {
  const sid = Number(req.params.sid);

  const show = database?.series?.[sid - 1];

  if (!show) {
    return res.status(404).send("Not found");
  }

  let episodeUrl = null;

  for (const season of show.seasons || []) {
    const ep = season.episodes.find(
      (e) => e.episode === Number(req.params.eid)
    );

    if (ep) {
      episodeUrl = ep.url;
      break;
    }
  }

  if (!episodeUrl) {
    return res.status(404).send("Episode not found");
  }

  res.redirect(episodeUrl);
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});