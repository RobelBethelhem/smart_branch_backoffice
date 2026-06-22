FROM mcr.microsoft.com/windows/servercore:ltsc2019
  SHELL ["powershell", "-Command"]
  RUN Invoke-WebRequest -Uri https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi -OutFile nodejs.msi ; Start-Process msiexec.exe -ArgumentList '/i', 'nodejs.msi', '/quiet', '/norestart' -Wait ; Remove-Item nodejs.msi
  WORKDIR C:/app
  COPY package*.json ./
  RUN npm install
  COPY . .
  RUN npm run build
  EXPOSE 4000
  CMD ["npm", "run", "serve"]