import './style.css'
import axios from "axios";

class Room{
    constructor(id) {
        this.id = id;
    }

    join(initiator){
        this.eventSource = new EventSource(`http://localhost:8080/room/${this.id}/events?initiator=${initiator}`)
        document.getElementById('join-room').style.display = 'none'
    }

    async send(data)
    {
        await axios.post(`http://localhost:8080/room/${this.id}`,data)
    }
}

let roomClientId = null
let room = null
let peer = null
let chatChannel = null


window.getPeer = () => {
    return peer
}

/**
 * Function to join a room
 */
function joinRoom(roomID, initiator = 0) {
    room = new Room(roomID)
    room.join(initiator)
    handleRoomEvent(room.eventSource)
}

function sendEvent(data){
    room.send(data)
}


/**
 * Function to handle room events
 * @param {EventSource} room
 */
function handleRoomEvent(room){
    room.addEventListener('message',({data:message})=>{
        try{
            const json = JSON.parse(message)
            console.log("ROOM EVENT",json)

            if(json.type == 'connected'){
                roomClientId = json.clientID
            }

            if(json.type == 'new'){
                createOffer(json.clientID)
            }

            if(json.type == 'offer'){
                handlePeerOffer(json.from, json.offer)
            }

            if(json.type == 'answer'){
                handlePeerAnswer(json.answer)
            }

            if(json.type == 'iceCandidate'){
                peer.addIceCandidate(json.candidate)
            }
        }catch (e){
            console.error(e)
        }
    })
}

async function createPeerConnection(remoteRoomClientId){
    peer = new RTCPeerConnection({})
    peer.addEventListener('icecandidate', (event)=>{
        if(event.candidate){
            sendEvent({
                to: remoteRoomClientId,
                type:"iceCandidate",
                candidate:event.candidate,
                from: roomClientId
            })
        }
    })

    peer.addEventListener('datachannel', (event)=>{
        handleChannelsEvent(event.channel)

    })
    return peer
}
/**
 *
 */
async function createOffer(remoteRoomClientId){
    peer = await createPeerConnection(remoteRoomClientId)
    const channel = peer.createDataChannel('chat')
    handleChannelsEvent(channel)
    const offer = await peer.createOffer()
    peer.setLocalDescription(offer)
    sendEvent({
        to: remoteRoomClientId,
        type:"offer",
        offer:offer,
        from: roomClientId
    })

}

async function handlePeerOffer(remoteRoomClientId, offer){
    peer = await createPeerConnection(remoteRoomClientId)
    peer.setRemoteDescription(offer)
    const answer = await peer.createAnswer()
    peer.setLocalDescription(answer)
    sendEvent({
        to: remoteRoomClientId,
        type:"answer",
        answer:answer,
        from : roomClientId
    })
}

function handlePeerAnswer(answer){
    peer.setRemoteDescription(answer)
}


function handleChannelsEvent(channel){
    if(channel.label == 'chat'){
        chatChannel = channel
    }
    const chatContainer = document.getElementById('chatContainer')
    channel.addEventListener('open', (event)=>{
        writeInChat("Chat is open", "System")
    })
    channel.addEventListener('message', (event)=>{
        writeInChat(event.data, "Remote")
    })
}



/**
 *
 * @param event
 */
function sendMessage(event){
    const messageInput = document.getElementById('message-input')
    writeInChat(messageInput.value, "Me")
    chatChannel.send(messageInput.value)
    messageInput.value = ''
}

function writeInChat(message, author){
    const chatContainer = document.getElementById('chatContainer')
    const paragraph = document.createElement('p')
    paragraph.classList.add(author == 'Me' ? 'me' : 'remote')
    paragraph.innerText = author + ' - ' + message
    chatContainer.appendChild(paragraph)
}


function handleJoinRoom(event){
    event.preventDefault()
    const roomForm =  document.getElementById('room-id-input')
    const roomID = roomForm.value
    joinRoom(roomID, 0)
}

document.getElementById('join-room').addEventListener('click', handleJoinRoom)
document.getElementById('send-message').addEventListener('click', sendMessage)