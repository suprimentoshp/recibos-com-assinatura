# Versao local Windows

Este projeto pode ser empacotado como `recibos-planalto.exe` para rodar em um computador servidor local.

## Como gerar o executavel

No PowerShell, dentro da pasta do projeto:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run build:exe
```

O arquivo sera gerado em:

```text
release\recibos-planalto.exe
```

## Como rodar

Copie a pasta `release` para uma pasta fixa, por exemplo:

```text
C:\RecibosPlanalto
```

Dentro dela devem ficar o executavel, o arquivo `app-sem-npm.html` e a pasta `dist`.

Depois execute:

```text
C:\RecibosPlanalto\recibos-planalto.exe
```

O navegador deve abrir automaticamente. Se nao abrir, acesse manualmente:

```text
http://localhost:3333
```

Mantenha a janela do executavel aberta enquanto estiver usando o sistema.

Na rede interna, outros computadores acessam usando o IP do servidor:

```text
http://IP-DO-SERVIDOR:3333
```

Exemplo:

```text
http://192.168.0.50:3333
```

## Onde ficam os dados

Na versao `.exe`, os dados ficam fora do programa:

```text
C:\ProgramData\RecibosPlanalto\data\recibos.json
```

Backups automaticos:

```text
C:\ProgramData\RecibosPlanalto\data\backups
```

Isso permite atualizar o `.exe` sem apagar o historico.

## Como atualizar o app

1. Feche o `recibos-planalto.exe` antigo.
2. Faca uma copia de seguranca da pasta `C:\ProgramData\RecibosPlanalto\data`.
3. Substitua o executavel antigo pelo novo.
4. Abra o novo `recibos-planalto.exe`.

O historico deve permanecer, porque ele nao fica dentro do executavel.

Se a atualizacao vier como uma nova pasta `release`, substitua o executavel, o `app-sem-npm.html` e a pasta `dist`. Nao apague `C:\ProgramData\RecibosPlanalto\data`.

## Cuidados importantes

- O computador servidor precisa ficar ligado para os demais acessarem.
- Configure backup externo da pasta `C:\ProgramData\RecibosPlanalto\data`.
- Se o firewall do Windows bloquear a porta 3333, libere o acesso na rede local.
- Para acesso fora da rede local, use VPN ou outra solucao segura. Evite expor a porta diretamente na internet.
