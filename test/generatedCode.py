
import torch.nn

import torch.nn.functional

import torch.optim

import torch.utils.data

# ########## User Defined Dataset Starts #########


from torchvision.datasets import MNIST
from torchvision.transforms import Compose, ToTensor, Normalize
class ABC:
    def __init__(self):
        pass


# ########## User Defined Dataset Ends #########

class MyModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.node6 = torch.nn.Flatten(start_dim=1,end_dim=3)
        self.node1 = torch.nn.Linear(in_features=784,out_features=512)
        self.node2 = torch.nn.Linear(in_features=512,out_features=256)
        self.node3 = torch.nn.Linear(in_features=256,out_features=10)
    def forward(self, x):
        y = self.node6(input=x)
        z = self.node1(input=y)
        a = self.node2(input=torch.nn.functional.relu(input=z))
        b = self.node3(input=torch.nn.functional.relu(input=a))
        return b

class MyLoss(torch.nn.Module):
    def __init__(self):
        super().__init__()
    def forward(self, x, y):
        return torch.nn.functional.cross_entropy(input=x,target=y)

class Training():
    def __init__(self):
        self.dataset = MNIST(root="../data",train=True,transform=Compose([ToTensor(), Normalize((0.1307,),(0.3081,))]),download=True)
        self.model = MyModel()
        self.lossFunction = MyLoss()
    def train(self):
        optimizer = torch.optim.Adam(params=self.model.parameters(),lr=1e-4)
        dataloader = torch.utils.data.DataLoader(dataset=self.dataset,batch_size=64)
        for batch_index, (inputs, targets) in enumerate(dataloader):
            optimizer.zero_grad()
            outputs = self.model(inputs)
            loss = self.lossFunction(outputs, targets)
            loss.backward()
            optimizer.step()
            if batch_index % 100 == 0:
                print("Batch: {}, Training Loss: {}".format(batch_index, loss))

if __name__ == '__main__':
    Training().train()