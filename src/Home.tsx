import * as React from "react";
import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "./candy-machine";

const ConnectButton = styled(WalletDialogButton)``;

const CounterText = styled.span``; // add your styles here

const MintContainer = styled.div``; // add your styles here

const MintButton = styled(Button)``; // add your styles here

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
  twitter: string;
  discord: string;
  comingSoon: boolean;
}

const Logo = () => {
  return <img src="logo.png" alt="Logo" className="logo" />;
};

interface SocialLinkProps {
  link: string;
  icon: string;
}

const SocialLink: React.FC<SocialLinkProps> = ({ icon, link }) => {
  return (
    <a href={link}>
      <img src={icon} alt="" className="social-icon" />
    </a>
  );
};
interface SocialMenuProps {
  children: JSX.Element[];
}

const SocialMenu: React.FC<SocialMenuProps> = ({ children }) => {
  //li for each social link
  return (
    <nav className="socials-menu">
      <ul>
        {children.map((icon) => (
          <li>{icon}</li>
        ))}
      </ul>
    </nav>
  );
};

interface HeaderProps {
  twitter: string;
  discord: string;
}

const Header: React.FC<HeaderProps> = ({twitter, discord}) => {
  return (
    <header>
      <Logo />
      <SocialMenu>
        <SocialLink link={twitter} icon="twitter.svg" />
        <SocialLink link={discord} icon="discord.svg" />
      </SocialMenu>
    </header>
  );
};

const Footer = () => {
  return (
    <footer>
      <h6>© 2021 Martianz</h6>
    </footer>
  );
};

interface RoadmapBulletProps {
  desc: string;
}

const RoadmapBullet: React.FC<RoadmapBulletProps> = ({ desc }) => {
  return (
    <div className="roadmap-bullet">
      <div className="phase-container">
        <span>Phase</span>
      </div>
      <div className="description-container">
        <span>{desc}</span>
      </div>
    </div>
  );
};
interface RoadmapProps {
  children: JSX.Element[];
}

const Roadmap: React.FC<RoadmapProps> = ({ children }) => {
  return (
    <section className="roadmap-container">
      <h2>Roadmap</h2>
        <ul>
        {children.map((ele) => (
          <li>{ele}</li>
        ))}
      </ul>
    </section>
  );
};

//all I need to do is parse date!

const Home = (props: HomeProps) => {
  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT

  const [itemsAvailable, setItemsAvailable] = useState(0);
  //* const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate * 1000));
  console.log(startDate.getTime())

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();

  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      console.log('refreshing state!')

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        //* itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRemaining(itemsRemaining);
      //* setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
    })();
  };

  const onMint = async () => {
    try {
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <>
    <Header twitter={props.twitter} discord={props.discord}/>
    <main>
      <Logo />
      <img src="mainbanner.png" alt="mockups gif" className="mockups-gif" />
      <div className="collection-desc">
        <p style={{fontWeight: "bold"}}>
          5555 unique Martianz NFTs, ready to colonise the Ethereum Blockchain.
        </p>
        <p>
          The alien inspired designs are all randomly generated accommodated with numerous 
          traits based on different rarities.
        </p>  
        <p>
          As we land on our new home we will strive to build our community first and foremost. 
          Holders will get access to airdrops, exclusive benefits, merchandise and more. Join us as we unite to bring
          long term value within the space.
        </p>
        <p>
          50% of all sales from mint will go into a community wallet and will go towards the evolution of the society.
          Martianz will be able to come together and make decisions on how these funds will be used through a voting system.
        </p>
        <p style={{fontWeight: "bold"}}>
          FAQs
        </p>
        <p>
          How much will it cost to mint?
        </p>
        <p>
          Absolutely nothing, FREE
        </p>
        <p>
          When?
        </p>
        <p>
          Follow our Twitter for updates (turn on notifications)
        </p>
        <p>
          How to mint?
        </p>
        <p>
          The contract address will be displayed here when the mint is live!
        </p>
      </div>

      {wallet && (
        <p>Wallet {shortenAddress(wallet.publicKey.toBase58() || "")}</p>
      )}

      {wallet && <p>Balance: {(balance || 0).toLocaleString()} SOL</p>}

      {wallet && <p className="remaining">{itemsRemaining}/{itemsAvailable} Remaining</p>}

      {props.comingSoon ? <div className="coming-soon">Coming Soon</div> : startDate && <MintContainer>
        {!wallet ? (
          <ConnectButton style={{marginBottom: "5rem", backgroundColor: "var(--primary-light)"}}>Connect Wallet</ConnectButton>
        ) : (
          <MintButton
          style={{marginBottom: "5rem", backgroundColor: "var(--primary-light)", color:"white"}}
            disabled={isSoldOut || isMinting || !isActive}
            onClick={onMint}
            variant="contained"
          >
            {isSoldOut ? (
              "SOLD OUT"
            ) : isActive ? (
              isMinting ? (
                <CircularProgress />
              ) : (
                "MINT"
              )
            ) : isNaN(startDate.getTime()) || startDate.getTime() - Date.now() > 63115200000 ? (
              "Coming Soon"
            ) : (
              <Countdown
                date={startDate}
                onMount={({ completed }) => completed && setIsActive(true)}
                onComplete={() => setIsActive(true)}
                renderer={renderCounter}
              />
            )}
          </MintButton>
        )}
      </MintContainer>}

      <Roadmap>
        <RoadmapBullet desc="Mint of 5555 Martianz" />
        <RoadmapBullet desc="Access to the Martianz Alpha which provides tools and more for your NFT journey" />
        <RoadmapBullet desc="Merch both physical and digital, building out the Martianz world" />
        <RoadmapBullet desc="More to come.." />
      </Roadmap>

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </main>
    <Footer />
    </>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
