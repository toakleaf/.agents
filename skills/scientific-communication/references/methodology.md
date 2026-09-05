# Methodology

These word banks are practical estimates, not official school curricula. They use the age-of-acquisition ratings published by Victor Kuperman, Hans Stadthagen-Gonzalez, and Marc Brysbaert in 2012. Native English speakers estimated the age when they learned each word.

The build script assigns words to the first grade level whose age cutoff includes them:

- First-grade bank: mean acquisition age of 7 or younger.
- Fifth-grade bank: mean acquisition age above 7 and no more than 11.
- Twelfth-grade bank: mean acquisition age above 11 and no more than 18.
- All banks: at least one recorded use per million words.

The marker loads banks cumulatively. Fifth grade includes first grade, and twelfth grade includes both lower levels. Each CSV stores only its new words, so the files do not duplicate lower-grade entries.

The script keeps lowercase English words with internal apostrophes or hyphens. It orders rows by frequency, with alphabetical ordering for ties. Each CSV records the word, mean acquisition age, and frequency per million words.

Run `scripts/build_word_banks.py` to rebuild the files. A pinned checksum prevents the script from using changed source data without review.

Sources: [published study](https://doi.org/10.3758/s13428-012-0210-4) and [machine-readable data](https://github.com/GliteTech/research-ace-cefr/tree/main/tasks/t0009_download_psycholinguistic_word_norms/assets/dataset/kuperman-aoa-2012).

The ratings are self-reported averages. They do not prove that every child knows every listed word at the stated age. Treat the banks as writing aids, not reading assessments.
