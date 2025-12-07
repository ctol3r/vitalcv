// src/routes/auth.linkedin.ts — OAuth start/callback (authorization code flow)

import express from 'express';

import axios from 'axios';

import cookieParser from 'cookie-parser';

import crypto from 'crypto';

export const linkedInAuth = express.Router();

linkedInAuth.use(cookieParser());



const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, LINKEDIN_SCOPES = "r_liteprofile r_emailaddress" } = process.env;



linkedInAuth.get("/", (req, res) => {

  const state = crypto.randomBytes(16).toString("hex");

  res.cookie("li_state", state, { httpOnly:true, secure:true, sameSite:"Strict" });

  const u = new URL("https://www.linkedin.com/oauth/v2/authorization");

  u.searchParams.set("response_type", "code");

  u.searchParams.set("client_id", LINKEDIN_CLIENT_ID!);

  u.searchParams.set("redirect_uri", LINKEDIN_REDIRECT_URI!);

  u.searchParams.set("state", state);

  u.searchParams.set("scope", LINKEDIN_SCOPES);

  res.redirect(u.toString());

});



linkedInAuth.get("/callback", async (req, res) => {

  const { code, state } = req.query as any;

  if (!code || state !== req.cookies["li_state"]) return res.status(403).send("state_mismatch");

  res.clearCookie("li_state");

  const token = await axios.post("https://www.linkedin.com/oauth/v2/accessToken",

    new URLSearchParams({

      grant_type:"authorization_code",

      code, redirect_uri: LINKEDIN_REDIRECT_URI!, client_id: LINKEDIN_CLIENT_ID!, client_secret: LINKEDIN_CLIENT_SECRET!

    }).toString(),

    { headers: { "Content-Type":"application/x-www-form-urlencoded" } }

  ).then(r=>r.data);



  const profile = await axios.get("https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)", { headers: { Authorization:`Bearer ${token.access_token}` } }).then(r=>r.data);

  const email = await axios.get("https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))", { headers: { Authorization:`Bearer ${token.access_token}` } }).then(r=>r.data?.elements?.[0]?.["handle~"]?.emailAddress || null);



  // TODO: upsert user enrichment record; store encrypted tokens server-side.

  return res.redirect(`/onboarding?li=1&name=${encodeURIComponent(profile.localizedFirstName)}%20${encodeURIComponent(profile.localizedLastName)}&email=${encodeURIComponent(email||"")}`);

});

