# HoopGeek - Fantasy Basketball App

A modern fantasy basketball application built with React, TypeScript, and Supabase. HoopGeek revolutionizes fantasy basketball by reducing daily time commitments through weekly lineups and introducing a salary cap system based on real NBA salaries.

## Features

### Core Features
- **Weekly Lineups**: Set your lineup once per week, no daily micromanagement
- **Salary Cap System**: Build teams around real NBA player salaries
- **Automatic IR Management**: Injured players are automatically moved to IR
- **Futuristic UI**: Modern, clean interface built with MUI Joy
- **Real-time Draft**: Live draft room with auto-pick functionality

### Planned Features
- League creation and management
- Email invitations
- Trade system with salary matching
- Global leaderboards
- Test teams against optimal lineups
- Social features and team sharing

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: MUI Joy
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Routing**: React Router v6
- **Animations**: Framer Motion
- **Date Handling**: date-fns

## Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/addthemup/hoopgeek.git
cd hoopgeek
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
src/
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── main.tsx           # Application entry point
```

## Development Roadmap

### Phase 1: Foundation ✅
- [x] Project setup with Vite + React + TypeScript
- [x] Supabase integration
- [x] Authentication system
- [x] Basic routing and navigation
- [x] MUI Joy UI components

### Phase 2: League Management (In Progress)
- [ ] League creation and joining
- [ ] Email invitation system
- [ ] Draft scheduling
- [ ] Member management

### Phase 3: Draft System
- [ ] Real-time draft room
- [ ] Auto-pick functionality
- [ ] Draft order management
- [ ] Player selection interface

### Phase 4: Team Management
- [ ] Weekly lineup setting
- [ ] Salary cap enforcement
- [ ] Automatic IR handling
- [ ] Trade system

### Phase 5: Advanced Features
- [ ] Global leaderboards
- [ ] Optimal team testing
- [ ] Social features
- [ ] Mobile optimization

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- GitHub: [@addthemup](https://github.com/addthemup)
- Project Link: [https://github.com/addthemup/hoopgeek](https://github.com/addthemup/hoopgeek)