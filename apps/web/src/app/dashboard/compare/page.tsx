'use client';

import React from 'react';

export default function CompareAIPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Compare AI</h1>
      <p className="text-sm text-muted-foreground">
        Coklu saglayici karsilastirma ekrani hazirlaniyor. Bu sayfa aktiflestirildi,
        backend endpointleri ile tam entegrasyon bir sonraki adimda tamamlanacak.
      </p>
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Hazirlik adimlari:
        <ul className="mt-2 list-disc pl-5">
          <li>Provider secimi (OpenAI, Anthropic, OpenRouter)</li>
          <li>Model ve reasoning effort parametreleri</li>
          <li>Sonuc karsilastirma matrisi (efor/saat/maliyet)</li>
        </ul>
      </div>
    </div>
  );
}
