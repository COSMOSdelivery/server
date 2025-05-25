const express = require('express');
const router = express.Router();
const bwipjs = require('bwip-js');

router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    bwipjs.toBuffer({
      bcid: 'code128',       // Type de code-barres (Code128 est très utilisé)
      text: code,            // Le texte à encoder (ex: COS-000001)
      scale: 3,              // Échelle (taille)
      height: 10,            // Hauteur du code-barres
      includetext: true,     // Affiche le texte sous le code
      textxalign: 'center',  // Centrer le texte
    }, (err, png) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur génération code-barres' });
      } else {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': png.length
        });
        res.end(png);
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
