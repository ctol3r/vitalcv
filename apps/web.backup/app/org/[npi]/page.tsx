"use client";

import { useParams } from "next/navigation";

import { useState, useEffect } from "react";



export default function OrgPage() {

  const params = useParams();

  const npi = params.npi as string;

  const [loading, setLoading] = useState(true);

  const [data, setData] = useState<any>(null);



  useEffect(() => {

    async function fetchOrg() {

      try {

        const res = await fetch(`/api/npi/lookup?number=${npi}`);

        const d = await res.json();

        setData(d);

      } catch (err) {

        console.error("Failed to fetch org data:", err);

      } finally {

        setLoading(false);

      }

    }

    if (npi) fetchOrg();

  }, [npi]);



  if (loading) return <div className="p-10">Loading organization data...</div>;

  if (!data) return <div className="p-10">Organization not found</div>;



  return (

    <div className="max-w-4xl mx-auto py-10 px-4">

      <h1 className="text-3xl font-bold mb-4">Organization Issuer/Vetting</h1>

      <div className="bg-white shadow rounded-lg p-6">

        <h2 className="text-xl font-semibold mb-2">{data.name || "Organization"}</h2>

        <p className="text-gray-600">NPI: {npi}</p>

        <p className="text-gray-600">Type: {data.entityTypeCode === 2 ? "Organization" : "Individual"}</p>

        {data.deactivationDate && (

          <p className="text-red-600 mt-2">Deactivated: {data.deactivationDate}</p>

        )}

        {data.replacementNpi && (

          <p className="text-blue-600 mt-2">Replacement NPI: {data.replacementNpi}</p>

        )}

        <div className="mt-6">

          <p className="text-sm text-gray-500">Issuer/vetting functionality coming soon...</p>

        </div>

      </div>

    </div>

  );

}

